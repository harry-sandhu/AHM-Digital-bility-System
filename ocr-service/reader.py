"""Read one picture: OCR + field extraction, with a second, more detailed read when it is worth it."""
import ocr_engine
from extract import extract

DETAIL = 1600          # text-detection size for the second read (see ocr_engine.ocr_boxes)
_ESSENTIAL = ("invoiceNoDate", "invoiceDate")   # an invoice without these was almost certainly read too coarsely


def _count(result):
    return sum(1 for v in result["fields"].values() if v)


def read(image):
    """-> (boxes, extract-result) for a PIL image.

    First a normal read. If it looks like an invoice page (enough label anchors found) but the invoice
    number or date is missing, small print was probably not detected: read again at higher detail and
    keep that read when it found more.
    """
    boxes = ocr_engine.ocr_boxes(image)
    try:
        result = extract(boxes)
    except Exception as exc:       # a parser bug must not lose the OCR text
        return boxes, {"fields": {}, "extra": {}, "warnings": [f"reader error: {type(exc).__name__}"]}
    if result.get("anchors", 0) >= 3 and any(k not in result["fields"] for k in _ESSENTIAL):
        try:
            boxes2 = ocr_engine.ocr_boxes(image, detail=DETAIL)
            result2 = extract(boxes2)
            if _count(result2) > _count(result):
                return boxes2, result2
        except Exception:
            pass
    return boxes, result
