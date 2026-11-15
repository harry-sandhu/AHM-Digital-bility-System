"""Thin wrapper around RapidOCR (PaddleOCR models on ONNX Runtime).

Returns text boxes with their pixel coordinates so the field reader can use
the page layout, not just the flat text.
"""
import ctypes
import gc
import io
import os
import threading

import numpy as np
from PIL import Image, ImageOps

# Phone photos are often far bigger than needed; capping the long side keeps
# peak memory and time down without hurting printed-text accuracy.
MAX_SIDE = int(os.environ.get("OCR_MAX_SIDE", "1600"))

_engine = None
_lock = threading.Lock()


MODEL_DIR = os.environ.get("OCR_MODEL_DIR", os.path.join(os.path.dirname(__file__), "models"))


def cpu_quota():
    """Container/cgroup CPU quota as a number of CPUs (cpu.max "75000 100000" -> 0.75), or None.
    Looks at the process's own cgroup and its parents, and at the namespace root (Docker)."""
    paths = ["/sys/fs/cgroup"]
    try:
        for line in open("/proc/self/cgroup"):
            if line.startswith("0::"):
                parts = line.strip().split("::", 1)[1].strip("/").split("/")
                paths += ["/sys/fs/cgroup/" + "/".join(parts[:i]) for i in range(1, len(parts) + 1)]
    except OSError:
        pass
    best = None
    for path in paths:
        try:
            quota, period = open(f"{path}/cpu.max").read().split()[:2]
            if quota != "max":
                q = int(quota) / int(period)
                best = q if best is None else min(best, q)
        except (OSError, ValueError):
            continue
    return best


def _thread_count() -> int:
    """ONNX Runtime threads to use: OCR_THREADS, else ceil(CPU quota), else 0 (library default)."""
    env = os.environ.get("OCR_THREADS")
    if env is not None:
        return int(env)
    q = cpu_quota()
    return 0 if q is None else max(1, -(-int(q * 100) // 100))


def _limit_ort_threads():
    """ONNX Runtime's default is fastest on a plain server (measured on one core: default 1.9 s,
    forced 1 thread 2.4 s, 2 threads 4.2 s). But under a hard CPU quota (e.g. Docker `cpus: 0.75`)
    its default one-spinning-thread-per-CPU pool gets throttled badly (40 s+ per page). So the
    default is left alone unless a quota is detected, and then threads = ceil(quota).
    Override with OCR_THREADS (0 = leave ONNX Runtime's default)."""
    import onnxruntime as ort

    threads = _thread_count()
    if threads <= 0:
        return
    original = ort.SessionOptions

    class CappedSessionOptions(original):  # RapidOCR does `from onnxruntime import SessionOptions`
        def __init__(self):
            super().__init__()
            self.intra_op_num_threads = threads
            self.inter_op_num_threads = 1

    ort.SessionOptions = CappedSessionOptions


# "v1" (default): rapidocr-onnxruntime 1.x with the PP-OCRv3 detector + an English recognition model.
# "v6": rapidocr 3.x with the PP-OCRv6 detection + recognition models (OCR_V6_SIZE: tiny | small | medium).
BACKEND = os.environ.get("OCR_BACKEND", "v1")


class _V6Engine:
    """PP-OCRv6 through rapidocr 3.x, wrapped to look like the 1.x engine to the code below."""

    def __init__(self):
        from rapidocr import ModelType, RapidOCR

        self.det_limit = int(float(os.environ.get("OCR_DET_LIMIT", "1100")))
        size = os.environ.get("OCR_V6_SIZE", "small")
        det_size = os.environ.get("OCR_V6_DET_SIZE", size)   # detection and recognition sizes can differ
        rec_size = os.environ.get("OCR_V6_REC_SIZE", size)
        params = {
            "Global.text_score": float(os.environ.get("OCR_TEXT_SCORE", "0.3")),
            "Global.use_cls": os.environ.get("OCR_ANGLE_CLS", "0") == "1",
            "Det.model_type": ModelType(det_size),
            "Rec.model_type": ModelType(rec_size),
            "Det.limit_side_len": self.det_limit,
            "Det.limit_type": os.environ.get("OCR_DET_TYPE", "max"),
            "Rec.rec_batch_num": int(os.environ.get("OCR_REC_BATCH", "6")),
        }
        # Models fetched by download_models.sh (tiny); the small ones are found inside the rapidocr package.
        mdir = os.environ.get("OCR_V6_MODEL_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models-v6"))
        for key, part, sz in (("Det.model_path", "det", det_size), ("Rec.model_path", "rec", rec_size)):
            path = os.path.join(mdir, f"PP-OCRv6_{part}_{sz}.onnx")
            if os.path.exists(path):
                params[key] = path
        threads = _thread_count()
        if threads > 0:
            params["EngineConfig.onnxruntime.intra_op_num_threads"] = threads
            params["EngineConfig.onnxruntime.inter_op_num_threads"] = 1
        self.engine = RapidOCR(params=params)

    def run(self, arr, detail=None):
        """-> [(box, text, score)] like the 1.x engine; `detail` is this call's detection size."""
        self.engine._load_det_model()
        self.engine.text_det.limit_side_len = detail or self.det_limit
        out = self.engine(arr)
        if out is None or out.boxes is None or out.txts is None:
            return []
        return list(zip(out.boxes, out.txts, out.scores))


def _get_engine():
    """English recognition model when present (keeps word spaces, which the
    default Chinese+English model drops: "O,NearKanchGodam"); otherwise the
    package default. Run ./download_models.sh to fetch it."""
    global _engine
    if _engine is None and BACKEND == "v6":
        _engine = _V6Engine()
    if _engine is None:
        _limit_ort_threads()
        from rapidocr_onnxruntime import RapidOCR

        rec = os.path.join(MODEL_DIR, "en_PP-OCRv3_rec_infer.onnx")
        keys = os.path.join(MODEL_DIR, "en_dict.txt")
        kwargs = dict(
            # Text-line detection is the main cost; it works on the picture scaled so its
            # longer side is at most this many pixels. Measured on one CPU core (ocr-eval/bench_speed.py):
            # 1100 keeps every field right on the real test photos and is ~25% faster than the
            # library default; 960 starts losing fields and 800 loses many.
            det_model_path=None,   # (RapidOCR needs the path key present: None = its bundled model)
            det_limit_side_len=float(os.environ.get("OCR_DET_LIMIT", "1100")),
            det_limit_type=os.environ.get("OCR_DET_TYPE", "max"),
            # Per-line 180-degree check. Photos are already upright (EXIF handled), so it only costs time.
            use_angle_cls=os.environ.get("OCR_ANGLE_CLS", "0") == "1",
            rec_batch_num=int(os.environ.get("OCR_REC_BATCH", "6")),
            # Height the recognition model is fed (48 for the PP-OCRv3 model; the light v2 model wants 32).
            rec_img_shape=[3, int(os.environ.get("OCR_REC_HEIGHT", "48")), 320],
            # Lines whose recognition confidence is under this are dropped. A lone digit (an invoice
            # number "5") scores low, so the library default of 0.5 loses it (0.3 found them without adding junk on the test sets).
            text_score=float(os.environ.get("OCR_TEXT_SCORE", "0.3")),
        )
        if os.path.exists(rec) and os.path.exists(keys):
            kwargs.update(rec_model_path=rec, rec_keys_path=keys)
        else:
            kwargs.update(rec_model_path=None)
        _engine = RapidOCR(**kwargs)
    return _engine


def open_image(data: bytes) -> Image.Image:
    """Decode and orient (phones store rotation in EXIF). Full resolution."""
    return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")


def _to_array(img: Image.Image) -> np.ndarray:
    if max(img.size) > MAX_SIDE:
        scale = MAX_SIDE / max(img.size)
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    return np.asarray(img)


def load_image(data: bytes) -> np.ndarray:
    return _to_array(open_image(data))


def _release_memory():
    """Hand freed memory back to the OS so a long-running service doesn't
    ratchet up its RSS as photos of different sizes come through."""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except OSError:
        pass


def estimate_skew(img: Image.Image, span: float = 30.0, step: float = 1.0) -> float:
    """Degrees to rotate the picture (PIL convention, counter-clockwise) so its text lines run horizontally.

    Classic projection-profile method on a small copy: the angle where the rows of ink are the
    most uneven is the one where the text lines are level. ~25 ms; accurate to about 0.3 degrees.
    """
    import cv2

    g = np.asarray(img.convert("L"))
    g = cv2.resize(g, None, fx=600 / max(g.shape), fy=600 / max(g.shape), interpolation=cv2.INTER_AREA)
    g = cv2.GaussianBlur(g, (3, 3), 0)
    bw = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 12)
    h, w = bw.shape

    def score(a: float) -> float:
        r = cv2.warpAffine(bw, cv2.getRotationMatrix2D((w / 2, h / 2), a, 1.0), (w, h), flags=cv2.INTER_NEAREST)
        return float(np.sum(np.diff(r.sum(axis=1).astype(np.float64)) ** 2))

    coarse = np.arange(-span, span + 0.01, step)
    best = float(coarse[int(np.argmax([score(a) for a in coarse]))])
    fine = np.arange(best - step, best + step + 0.01, 0.25)
    return float(fine[int(np.argmax([score(a) for a in fine]))])


def straighten(img: Image.Image) -> Image.Image:
    """Rotate a clearly tilted page upright before reading. A tilt under OCR_STRAIGHTEN_MIN degrees is left
    alone (rotating blurs the text a little, which costs more than a slight tilt does). 0 turns it off."""
    limit = float(os.environ.get("OCR_STRAIGHTEN_MIN", "5"))
    if limit <= 0:
        return img
    try:
        angle = estimate_skew(img)
    except Exception:
        return img
    if abs(angle) < limit:
        return img
    return img.rotate(angle, expand=True, fillcolor=(255, 255, 255), resample=Image.BICUBIC)


def ocr_boxes(data, detail: int | None = None) -> list[dict]:
    """[{text, conf, pts:[[x,y]*4]}] in reading-agnostic order.
    Accepts raw image bytes or an already-opened PIL image.

    `detail` overrides, for this call only, the size the picture is scaled to for text-line detection
    (OCR_DET_LIMIT, 1100 by default). Larger finds smaller print (dates, IRN lines on a dense A4 page)
    but is slower, so it is used for a second read only when something important was missed."""
    img = data if isinstance(data, Image.Image) else open_image(data)
    arr = _to_array(straighten(img))
    with _lock:  # one OCR at a time: bounds memory on a small VPS
        eng = _get_engine()
        if BACKEND == "v6":
            try:
                result = eng.run(arr, detail)
            finally:
                del arr
                _release_memory()
        else:
            op = eng.text_detector.preprocess_op[0]
            saved = getattr(op, "limit_side_len", None)
            if detail:
                op.limit_side_len = detail
            try:
                result, _ = eng(arr)
            finally:
                if detail and saved is not None:
                    op.limit_side_len = saved
                del arr
                _release_memory()
    return [
        {"text": text, "conf": float(conf), "pts": [[float(x), float(y)] for x, y in box]}
        for box, text, conf in (result or [])
    ]


def engine_name() -> str:
    """Which engine reads pictures right now, e.g. "v1" or "v6-small" (shown in scan results)."""
    if BACKEND == "v6":
        return "v6-" + os.environ.get("OCR_V6_SIZE", "small")
    return "v1"


def _selftest_image() -> Image.Image:
    from PIL import ImageDraw, ImageFont

    img = Image.new("RGB", (900, 260), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=44)
    except TypeError:                                  # very old Pillow
        font = ImageFont.load_default()
    d.text((30, 30), "Tax Invoice No. 4172", fill="black", font=font)
    d.text((30, 130), "GSTIN 05AABCM9381J1Z6", fill="black", font=font)
    return img


def selftest() -> None:
    """Load the engine and read a small picture; raises if nothing is read. Run in a child process."""
    boxes = ocr_boxes(_selftest_image())
    if not boxes:
        raise RuntimeError("self-test read nothing")


def check_backend(timeout: float = 180.0) -> tuple[str, float | None, str]:
    """Start-up safety net for the new engine. Tries it in a CHILD process first, because a server CPU
    that lacks an instruction the library needs kills the process outright (no Python exception to catch).
    -> (backend to use, seconds the self-test took, note). Falls back to "v1" when the child fails."""
    global BACKEND
    if BACKEND == "v1":
        return "v1", None, ""
    import subprocess
    import sys
    import time

    t0 = time.time()
    try:
        proc = subprocess.run([sys.executable, "-c", "import ocr_engine; ocr_engine.selftest()"],
                              cwd=os.path.dirname(os.path.abspath(__file__)), capture_output=True, timeout=timeout)
        ok, note = proc.returncode == 0, ("" if proc.returncode == 0 else f"exit code {proc.returncode}")
    except subprocess.TimeoutExpired:
        ok, note = False, f"no answer in {timeout:.0f} s"
    took = time.time() - t0
    if not ok:
        BACKEND = "v1"
        return "v1", took, f"engine {os.environ.get('OCR_BACKEND')} failed its self-test ({note}); using v1"
    return BACKEND, took, ""
