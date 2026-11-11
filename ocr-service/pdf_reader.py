"""Reads PDF invoices.

Digital PDFs (Tally "Save as PDF", e-invoices) carry their text with exact
positions, so no OCR is needed: faster and error-free. Scanned PDFs (no text
layer) are rendered to an image and OCR'd like a photo.

Uses poppler's pdftotext/pdfinfo/pdftoppm (apt: poppler-utils).
"""
import html
import os
import re
import subprocess
import tempfile

from PIL import Image

import ocr_engine
import qr as qr_reader
from extract import extract
from reconcile import reconcile

DPI = 150
SCALE = DPI / 72.0          # PDF points -> pixels at 150 dpi: the reader's tolerances assume ~150 dpi pages
MAX_PAGES = 4
MIN_WORDS_FOR_TEXT_PAGE = 15

_LINE = re.compile(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', re.S)
_WORD = re.compile(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', re.S)


def _run(args, **kw):
    return subprocess.run(args, capture_output=True, timeout=30, **kw)


def page_count(path):
    out = _run(["pdfinfo", path]).stdout.decode("utf-8", "ignore")
    m = re.search(r"^Pages:\s+(\d+)", out, re.M)
    return int(m.group(1)) if m else 1


def text_boxes(path, page):
    """Text boxes (same shape as the OCR's) from the PDF's text layer, or None if the page has no text."""
    out = _run(["pdftotext", "-f", str(page), "-l", str(page), "-bbox-layout", "-enc", "UTF-8", path, "-"]).stdout
    doc = out.decode("utf-8", "ignore")
    boxes, n_words = [], 0
    for lm in _LINE.finditer(doc):
        words = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in _WORD.findall(lm.group(5))]
        n_words += len(words)
        group = []
        for w in words:
            height = w[3] - w[1]
            if group and w[0] - group[-1][2] > max(8.0, 0.9 * height):   # a wide gap = a different table cell
                boxes.append(group); group = []
            group.append(w)
        if group:
            boxes.append(group)
    if n_words < MIN_WORDS_FOR_TEXT_PAGE:
        return None
    result = []
    for g in boxes:
        x0, y0 = min(w[0] for w in g) * SCALE, min(w[1] for w in g) * SCALE
        x1, y1 = max(w[2] for w in g) * SCALE, max(w[3] for w in g) * SCALE
        result.append({"text": " ".join(w[4] for w in g), "conf": 1.0, "pts": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]})
    return result


def render_page(path, page):
    with tempfile.TemporaryDirectory() as d:
        prefix = os.path.join(d, "p")
        _run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(DPI), "-png", "-singlefile", path, prefix])
        return Image.open(prefix + ".png").convert("RGB")


def read_pdf(data):
    """PDF bytes -> {"fields", "extra", "warnings", "verified", "pages": [...]}"""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(data)
        path = f.name
    try:
        n = min(page_count(path), MAX_PAGES)
        pages = []
        for p in range(1, n + 1):
            boxes, source = text_boxes(path, p), "text"
            if boxes is None:
                source = "ocr"
                boxes = ocr_engine.ocr_boxes(render_page(path, p))
            r = extract(boxes)
            r["page"], r["source"] = p, source
            pages.append(r)

        # the invoice page = the one where the most layout anchors were found
        ranked = sorted(pages, key=lambda r: (r.get("anchors", 0), len(r["fields"])), reverse=True)
        best = ranked[0]
        result = {"fields": dict(best["fields"]), "extra": dict(best["extra"]), "warnings": list(best["warnings"]),
                  "anchors": best.get("anchors", 0)}
        # other copies of the invoice (e.g. "DUPLICATE FOR TRANSPORTER") can fill what the best one missed
        for other in ranked[1:]:
            if other.get("anchors", 0) >= 4:
                for k, v in other["fields"].items():
                    result["fields"].setdefault(k, v)
                for k, v in other["extra"].items():
                    result["extra"].setdefault(k, v)
        result["pages"] = [{"page": r["page"], "source": r["source"], "anchors": r.get("anchors", 0)} for r in pages]

        qr_data = None
        try:
            qr_data = qr_reader.decode_einvoice(render_page(path, best["page"]))
        except Exception:
            pass
        reconcile(result, qr_data)
        return result
    finally:
        os.unlink(path)
