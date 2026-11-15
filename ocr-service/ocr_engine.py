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


def _limit_ort_threads():
    """ONNX Runtime's default is fastest on a plain server (measured on one core: default 1.9 s,
    forced 1 thread 2.4 s, 2 threads 4.2 s). But under a hard CPU quota (e.g. Docker `cpus: 0.75`)
    its default one-spinning-thread-per-CPU pool gets throttled badly (40 s+ per page). So the
    default is left alone unless a quota is detected, and then threads = ceil(quota).
    Override with OCR_THREADS (0 = leave ONNX Runtime's default)."""
    import onnxruntime as ort

    env = os.environ.get("OCR_THREADS")
    if env is not None:
        threads = int(env)
    else:
        q = cpu_quota()
        threads = 0 if q is None else max(1, -(-int(q * 100) // 100))
    if threads <= 0:
        return
    original = ort.SessionOptions

    class CappedSessionOptions(original):  # RapidOCR does `from onnxruntime import SessionOptions`
        def __init__(self):
            super().__init__()
            self.intra_op_num_threads = threads
            self.inter_op_num_threads = 1

    ort.SessionOptions = CappedSessionOptions


def _get_engine():
    """English recognition model when present (keeps word spaces, which the
    default Chinese+English model drops: "O,NearKanchGodam"); otherwise the
    package default. Run ./download_models.sh to fetch it."""
    global _engine
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
