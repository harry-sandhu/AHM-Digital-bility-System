"""Compare the OCR result with the e-invoice QR and keep the QR's exact values."""
import re


def _alnum(s):
    return re.sub(r"[^A-Z0-9]", "", str(s or "").upper())


def _money(v):
    return str(int(v)) if v == int(v) else f"{v:.2f}"


def reconcile(result, qr):
    """Mutates `result` (fields/warnings) and sets result["verified"]."""
    verified, warnings, f = [], result.setdefault("warnings", []), result.setdefault("fields", {})
    result["verified"] = verified
    if not qr:
        return result

    # invoice number
    ocr_no = f.get("invoiceNoDate")
    if ocr_no and _alnum(ocr_no) == _alnum(qr["docNo"]):
        verified.append("invoiceNoDate")
    elif ocr_no:
        warnings.append(f"invoice number: the printed text read {ocr_no!r} but the QR says {qr['docNo']!r}; used the QR value")
    f["invoiceNoDate"] = qr["docNo"]

    # invoice date
    if qr.get("docDate"):
        if f.get("invoiceDate") == qr["docDate"]:
            verified.append("invoiceDate")
        elif f.get("invoiceDate"):
            warnings.append(f"invoice date: the printed text read {f['invoiceDate']} but the QR says {qr['docDate']}; used the QR value")
        f["invoiceDate"] = qr["docDate"]

    # seller GSTIN
    if f.get("consignorGstin") == qr["sellerGstin"]:
        verified.append("consignorGstin")
    elif f.get("consignorGstin"):
        warnings.append(f"consignor GSTIN: the printed text read {f['consignorGstin']} but the QR says {qr['sellerGstin']}; used the QR value")
    f["consignorGstin"] = qr["sellerGstin"]
    warnings[:] = [w for w in warnings if not w.startswith("consignorGstin:")]   # the QR settles it

    # invoice total (the QR has it even on page 1 of a multi-page invoice)
    if qr.get("total"):
        qv = _money(qr["total"])
        if f.get("declaredValue") == qv:
            verified.append("declaredValue")
        elif f.get("declaredValue"):
            warnings.append(f"total: the printed text read {f['declaredValue']} but the QR says {qv}; used the QR value")
        f["declaredValue"] = qv

    # buyer GSTIN: the QR holds the bill-to party, the form wants ship-to, so only confirm
    if qr.get("buyerGstin") and f.get("consigneeGstin") == qr["buyerGstin"]:
        verified.append("consigneeGstin")
        warnings[:] = [w for w in warnings if not w.startswith("consigneeGstin:")]
    if qr.get("total"):
        warnings[:] = [w for w in warnings if not w.startswith("declaredValue:")]
    return result
