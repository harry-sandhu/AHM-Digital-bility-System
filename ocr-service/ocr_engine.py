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


def _get_engine():
    """English recognition model when present (keeps word spaces, which the
    default Chinese+English model drops: "O,NearKanchGodam"); otherwise the
    package default. Run ./download_models.sh to fetch it."""
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR

        rec = os.path.join(MODEL_DIR, "en_PP-OCRv3_rec_infer.onnx")
        keys = os.path.join(MODEL_DIR, "en_dict.txt")
        if os.path.exists(rec) and os.path.exists(keys):
            _engine = RapidOCR(rec_model_path=rec, rec_keys_path=keys)
        else:
            _engine = RapidOCR()
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
