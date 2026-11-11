"""Score OCR/extraction output against data/truth.json.

Scoring logic shared by score.py and analyze.py.

A predictions file maps image name -> the extractor's fields. It understands
the backend's current field names (invoiceNoDate, invoiceDate, consignorAddress,
consignorGstin, consigneeAddress, consigneeGstin, packages, declaredValue) plus
the ones the current extractor does NOT produce yet (lorryNo, to, lrNo,
consigneePhone) -- those simply score as "missing" until an extractor fills them.
"""
import json, re, sys
from datetime import datetime
from difflib import SequenceMatcher

HERE = __import__("os").path.dirname(__file__)


def alnum(s):
    return re.sub(r"[^A-Z0-9]", "", str(s or "").upper())


def to_number(s):
    m = re.search(r"[\d,]+(?:\.\d+)?", str(s or ""))
    return float(m.group(0).replace(",", "")) if m else None


def to_iso(s):
    s = str(s or "").strip()
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def contains_fuzzy(haystack, needle, threshold=0.85):
    h, n = alnum(haystack), alnum(needle)
    if not n or not h:
        return False
    if n in h:
        return True
    best = 0.0
    for i in range(0, max(1, len(h) - len(n) + 1)):
        best = max(best, SequenceMatcher(None, h[i:i + len(n)], n).ratio())
    return best >= threshold


# field -> (truth key, predicate(pred_dict, truth_value))
def f_eq_alnum(pred_keys):
    return lambda p, t: any(alnum(p.get(k)) == alnum(t) for k in pred_keys)


FIELDS = {
    "invoice no":        ("invoiceNo",     lambda p, t: alnum(t) in alnum(p.get("invoiceNoDate")) and bool(p.get("invoiceNoDate"))),
    "invoice date":      ("invoiceDate",   lambda p, t: to_iso(p.get("invoiceDate")) == t),
    "consignor gstin":   ("sellerGstin",   f_eq_alnum(["consignorGstin"])),
    "consignor name":    ("sellerName",    lambda p, t: contains_fuzzy(p.get("consignorAddress"), re.sub(r"\(.*?\)", "", t))),
    "consignee gstin":   ("consigneeGstin", f_eq_alnum(["consigneeGstin"])),
    "consignee name":    ("consigneeName", lambda p, t: contains_fuzzy(p.get("consigneeAddress"), t)),
    "consignee address": ("consigneeAddress", lambda p, t: contains_fuzzy(p.get("consigneeAddress"), t, 0.8)),
    "consignee phone":   ("consigneeMobile", f_eq_alnum(["consigneePhone", "phoneNo"])),
    "vehicle (lorry) no": ("vehicleNo",    f_eq_alnum(["lorryNo"])),
    "to (destination)":  ("destination",   lambda p, t: contains_fuzzy(p.get("to"), t)),
    "lr no":             ("lrNo",          f_eq_alnum(["lrNo"])),
    "total pieces":      ("totalPcs",      lambda p, t: to_number(p.get("packages")) == float(t)),
    "total amount":      ("totalAmount",   lambda p, t: to_number(p.get("declaredValue")) == float(t)),
}
PRED_KEYS = {  # which prediction key(s) mean "the extractor produced something" for this field
    "invoice no": ["invoiceNoDate"], "invoice date": ["invoiceDate"], "consignor gstin": ["consignorGstin"],
    "consignor name": ["consignorAddress"], "consignee gstin": ["consigneeGstin"], "consignee name": ["consigneeAddress"],
    "consignee address": ["consigneeAddress"], "consignee phone": ["consigneePhone", "phoneNo"],
    "vehicle (lorry) no": ["lorryNo"], "to (destination)": ["to"], "lr no": ["lrNo"],
    "total pieces": ["packages"], "total amount": ["declaredValue"],
}




def evaluate(preds, truth):
    """-> {image: {field: "right"|"wrong"|"missing"}} for every field that has a true value."""
    out = {}
    for img, t in truth.items():
        p = preds.get(img, {})
        res = {}
        for name, (tkey, ok) in FIELDS.items():
            tv = t.get(tkey)
            if tv in (None, ""):
                continue  # not on the invoice / not visible -> not scored
            if not any(p.get(k) for k in PRED_KEYS[name]):
                res[name] = "missing"
            else:
                try:
                    res[name] = "right" if ok(p, tv) else "wrong"
                except Exception:
                    res[name] = "wrong"
        out[img] = res
    return out


def false_fills(preds, truth):
    """Values filled in where the invoice has none (a different kind of wrong)."""
    pairs = [("consigneeGstin", "consigneeGstin"), ("to", "destination"), ("phoneNo", "consigneeMobile"),
             ("packages", "totalPcs"), ("declaredValue", "totalAmount")]
    return [(img, pk) for img, t in truth.items() for pk, tk in pairs
            if t.get(tk) in (None, "") and preds.get(img, {}).get(pk)]
