"""Reads the e-invoice QR code (a signed JWT whose payload carries the invoice
number, date, total value and the seller/buyer GSTINs).

When it decodes, its values are exact, so they are used to verify the OCR
result and to fill what the printed page may lack (e.g. the total on page 1 of
a 2-page invoice). When it can't be read, nothing changes.
"""
import base64
import json
import time
from datetime import datetime

import zxingcpp
from PIL import Image, ImageFilter, ImageOps

_NEEDED = ("DocNo", "SellerGstin")


def _payload(text):
    try:
        part = text.split(".")[1]
        data = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        if isinstance(data.get("data"), str):
            data = json.loads(data["data"])
        return data if all(k in data for k in _NEEDED) else None
    except Exception:
        return None


def _candidates(img):
    W, H = img.size
    yield img
    # the QR is printed in the top-right of the page: try crops, enlarged and enhanced
    for box in ((0.5, 0.0, 1.0, 0.4), (0.55, 0.02, 1.0, 0.3), (0.45, 0.0, 1.0, 0.5)):
        crop = img.crop((int(W * box[0]), int(H * box[1]), int(W * box[2]), int(H * box[3])))
        for scale in (1.0, 2.0, 3.0):
            c = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS) if scale != 1 else crop
            yield c
            yield ImageOps.autocontrast(c, cutoff=2).filter(ImageFilter.SHARPEN)
            yield c.point(lambda v: 255 if v > 140 else 0)


def decode_einvoice(img, budget_s=1.5):
    """PIL image -> dict(docNo, docDate(ISO), sellerGstin, buyerGstin, total, items) or None.
    Gives up after `budget_s` seconds: most photos either decode quickly or have no readable QR."""
    gray = img.convert("L")
    deadline = time.time() + budget_s
    for cand in _candidates(gray):
        if time.time() > deadline:
            return None
        for r in zxingcpp.read_barcodes(cand):
            if r.format != zxingcpp.BarcodeFormat.QRCode:
                continue
            p = _payload(r.text)
            if not p:
                continue
            iso = None
            try:
                iso = datetime.strptime(str(p.get("DocDt", "")), "%d/%m/%Y").strftime("%Y-%m-%d")
            except ValueError:
                pass
            try:
                total = float(p.get("TotInvVal"))
            except (TypeError, ValueError):
                total = None
            return {
                "docNo": str(p["DocNo"]),
                "docDate": iso,
                "sellerGstin": str(p["SellerGstin"]).upper(),
                "buyerGstin": str(p.get("BuyerGstin") or "").upper() or None,
                "total": total,
                "items": p.get("ItemCnt"),
            }
    return None
