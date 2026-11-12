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


def ocr_boxes(data) -> list[dict]:
    """[{text, conf, pts:[[x,y]*4]}] in reading-agnostic order.
    Accepts raw image bytes or an already-opened PIL image."""
    arr = _to_array(data) if isinstance(data, Image.Image) else load_image(data)
    with _lock:  # one OCR at a time: bounds memory on a small VPS
        try:
            result, _ = _get_engine()(arr)
        finally:
            del arr
            _release_memory()
    return [
        {"text": text, "conf": float(conf), "pts": [[float(x), float(y)] for x, y in box]}
        for box, text, conf in (result or [])
    ]
