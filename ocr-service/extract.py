"""Reads a photographed Tally-style tax invoice by *position*.

Input: OCR text boxes with coordinates (see ocr_engine.ocr_boxes).
Output: values for the bilty form, plus warnings for anything uncertain.

Approach: straighten the page, then locate fixed anchors ("Invoice No.",
"Consignee (Ship to)", "Motor Vehicle No." ...) and read the area beside or
below each one. GSTINs are repaired by position and checked with their
built-in check character.
"""
import math
import re
import statistics
from datetime import datetime
from difflib import SequenceMatcher

from gstin import check_char, is_valid

GSTIN_RE = re.compile(r"[0-9A-Z]{15}")
VEHICLE_RE = re.compile(r"\b([A-Z]{2})\s?(\d{1,2})\s?([A-Z]{1,3})\s?(\d{4})\b")
DATE_RE = re.compile(r"(\d{1,2})\s?-\s?([A-Za-z]{3})\s?-\s?(\d{2,4})")
LR_RE = re.compile(r"(\d{3,7})\s*dt\.?\s*(\d{1,2}\s?-\s?[A-Za-z]{3}\s?-\s?\d{2,4})", re.I)
AMOUNT_RE = re.compile(r"\d[\d,]*\.\d{2}")
# OCR sometimes inserts spaces or turns commas into dots: "13,78 765.00", "13.78.765.00"
_LOOSE_AMOUNT = re.compile(
    r"(?<![\d,.])(?:\d{1,3}(?:[,.]\d{2,3}|[ ]\d{3}(?=[.,]\d{2}(?!\d)))*|\d+)[.,]\d{2}(?!\d)"
)
_STRICT_AMOUNT = re.compile(r"^(\d{1,3}(,\d{3})*|\d{1,2}(,\d{2})*,\d{3}|\d+)\.\d{2}$")


def parse_amounts(text):
    """-> [(value, well_formed)] for every money amount in `text`."""
    out = []
    for m in _LOOSE_AMOUNT.finditer(text):
        raw = m.group(0).strip()
        digits = re.sub(r"\D", "", raw)
        if len(digits) < 3:
            continue
        out.append((int(digits[:-2]) + int(digits[-2:]) / 100.0, bool(_STRICT_AMOUNT.match(raw))))
    return out
PCS_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*P[CGO]S", re.I)
_PIECE_UNITS = {"PCS", "PGS", "PCO", "NOS", "NO", "BAG", "BAGS", "BOX", "BOXES", "CTN", "BDL", "ROLL", "ROLLS"}
_WEIGHT_UNITS = {"KG": "KG", "KGS": "KG", "MT": "MT", "MTS": "MT", "QTL": "QTL"}
QTY_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(P[CGO]S|NOS?|KGS?|MTS?|QTL|BAGS?|BOXES|BOX|SQMT|SQM|LTRS?|CTN|BDL|ROLLS?)(?![A-Za-z])", re.I)
UNIT_WORD = re.compile(r"\b(?:P[CGO]S|NOS?|KGS?|MTS?|QTL|BAGS?|BOXES|BOX|SQ?MT|SQM|LTRS?|CTN|BDL|ROLLS?)\b", re.I)
PACKS_RE = re.compile(r"(\d+)\s*(BAGS?|BOXES|BOX|CARTONS?|DRUMS?|ROLLS?|BUNDLES?|PKTS?)\s*[X\u00d7]\s*\d", re.I)


def _num(text):
    v = float(text.replace(",", ""))
    return str(int(v)) if v == int(v) else f"{v:g}"

# characters OCR commonly swaps, by the kind of character the position needs
_TO_DIGIT = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2", "G": "6", "T": "7"}
_TO_LETTER = {"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G", "7": "T"}
# per-position type of a GSTIN: D=digit, L=letter, A=either, Z=literal Z
_GSTIN_SHAPE = "DDLLLLLDDDDLAZA"


class Item:
    __slots__ = ("text", "conf", "x0", "y0", "x1", "y1")

    def __init__(self, text, conf, pts):
        self.text, self.conf = text.strip(), conf
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        self.x0, self.x1, self.y0, self.y1 = min(xs), max(xs), min(ys), max(ys)

    @property
    def h(self):
        return self.y1 - self.y0

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2


def _deskew(boxes):
    """Rotate all coordinates so the text lines are horizontal."""
    angles = []
    for b in boxes:
        (x0, y0), (x1, y1) = b["pts"][0], b["pts"][1]
        if len(b["text"]) > 4 and (x1 - x0) > 30:
            angles.append(math.degrees(math.atan2(y1 - y0, x1 - x0)))
    tilt = statistics.median(angles) if angles else 0.0
    if abs(tilt) < 0.25:
        return [Item(b["text"], b["conf"], b["pts"]) for b in boxes], 0.0
    allp = [p for b in boxes for p in b["pts"]]
    cx = sum(p[0] for p in allp) / len(allp)
    cy = sum(p[1] for p in allp) / len(allp)
    c, s = math.cos(math.radians(-tilt)), math.sin(math.radians(-tilt))
    rot = lambda p: [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]
    return [Item(b["text"], b["conf"], [rot(p) for p in b["pts"]]) for b in boxes], tilt


def clean_company(name):
    """Drop Tally's financial-year suffix: "... Ltd. (2026-27)" -> "... Ltd."."""
    return re.sub(r"\s*\(?\s*20\d\d-\d\d\s*\)?\s*$", "", name or "").strip()


def tidy(line):
    line = line.replace("：", ":").replace("’", "'")
    line = re.sub(r"\s+", " ", line).strip(" :;-|")
    line = re.sub(r",(?=[A-Za-z0-9])", ", ", line)          # "Kichha Road,Rudrapur"
    line = re.sub(r"(?<=[a-z])\.(?=[A-Z][a-z])", ". ", line)  # "Pvt.Ltd." -> "Pvt. Ltd."
    line = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", line)           # "RudrapurU.S." -> "Rudrapur U.S."
    line = re.sub(r"(?<=[A-Z]\.)(?=[A-Z][a-z])", " ", line)     # "U.S.Nagar" -> "U.S. Nagar"
    return line


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


_LABELISH = re.compile(r"\b(no|date|dated|order|note|ref|reference|bill|way|dispatch|delivery|terms|mode)\b", re.I)


def clean_invoice_no(text):
    """An invoice number has a digit and is one token ("S/26-27/153", "636").
    Anything else is a neighbouring label or junk and is better left blank."""
    for tok in re.split(r"\s+", tidy(text or "")):
        if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9/\-._]{0,24}", tok) and re.search(r"\d", tok) and not _LABELISH.search(tok):
            return tok
    return None


def to_iso(text):
    m = DATE_RE.search(text or "")
    if not m:
        return None
    d, mon, y = m.groups()
    try:
        return datetime.strptime(f"{int(d)}-{mon.title()}-{y[-2:]}", "%d-%b-%y").strftime("%Y-%m-%d")
    except ValueError:
        return None


# ---------------------------------------------------------------- GSTIN ----

# characters OCR confuses with each other (either direction)
_CONFUSABLE = {"O": "0", "0": "O", "I": "1", "1": "I", "S": "5", "5": "S", "B": "8", "8": "B",
               "Z": "2", "2": "Z", "G": "6", "6": "G", "T": "7", "7": "T", "Q": "0", "D": "0"}


def fix_gstin(raw):
    """Repair look-alike characters; return (gstin, status).

    status is "valid"      - the check character matches (after only fixing
                             characters of the wrong *kind* for their position),
                "repaired"  - exactly one look-alike swap made it valid; plausible
                             but it can be a coincidence (about 1 in 36 per try), so
                             callers must ask the user to verify,
                "unverified"- the check character doesn't match; returned as read.
    The check character is never rewritten to force a pass.
    """
    s = re.sub(r"[^0-9A-Z]", "", (raw or "").upper())
    if len(s) != 15:
        return None, "unverified"
    out = []
    for ch, kind in zip(s, _GSTIN_SHAPE):
        if kind == "D" and not ch.isdigit():
            ch = _TO_DIGIT.get(ch, ch)
        elif kind == "L" and not ch.isalpha():
            ch = _TO_LETTER.get(ch, ch)
        elif kind == "Z" and ch != "Z":
            ch = "Z" if ch in "2S5" else ch
        out.append(ch)
    cand = "".join(out)
    if is_valid(cand):
        return cand, "valid"

    fixes = set()
    for i, ch in enumerate(cand):
        alt = _CONFUSABLE.get(ch)
        if alt:
            trial = cand[:i] + alt + cand[i + 1:]
            if is_valid(trial):
                fixes.add(trial)
    if len(fixes) == 1:
        return fixes.pop(), "repaired"
    return cand, "unverified"


_GSTIN_SHAPE_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_RANK = {"valid": 0, "repaired": 1, "unverified": 2}


def find_gstin(text):
    """Best GSTIN-looking token in `text` -> (gstin, status), or (None, "unverified").
    Tokens that are not even shaped like a GSTIN after repair are ignored
    (addresses are full of 15-character runs)."""
    squashed = re.sub(r"[\s:]", "", text.upper())
    best = None
    for m in re.finditer(r"(?=([0-9A-Z]{15}))", squashed):
        g, status = fix_gstin(m.group(1))
        if g and _GSTIN_SHAPE_RE.match(g):
            if status == "valid":
                return g, status
            if best is None or _RANK[status] < _RANK[best[1]]:
                best = (g, status)
    return best or (None, "unverified")


def _gstin_warning(field, status):
    if status == "repaired":
        return f"{field}: a look-alike character was corrected, please verify"
    if status == "unverified":
        return f"{field}: check character does not match, please verify"
    return None


# --------------------------------------------------------------- layout ----

class Page:
    def __init__(self, boxes):
        self.items, self.tilt = _deskew(boxes)

    def find(self, pattern, below=None):
        rx = re.compile(pattern, re.I)
        hits = [i for i in self.items if rx.search(_norm_text(i.text))]
        if below is not None:
            hits = [i for i in hits if i.y0 > below]
        return sorted(hits, key=lambda i: (i.y0, i.x0))

    def anchor(self, target, threshold=0.78):
        """Best fuzzy match for a printed label, tolerating OCR typos
        ("Consignec (Ship to)", "Buyer (Bil to")."""
        t = _letters(target)
        best, best_r = None, threshold
        for i in self.items:
            txt = _letters(i.text)
            if len(txt) < max(3, len(t) - 4):
                continue
            r = SequenceMatcher(None, txt[: len(t) + 2], t).ratio()
            if r >= best_r:
                best, best_r = i, r
        return best

    def anchor_any(self, targets, threshold=0.78):
        """Like anchor() but accepts several wordings of the same label. Short
        wordings ("shipto", "lrno") must match exactly so that e.g. "Buyer's Order
        No." is never mistaken for "Buyer"."""
        best, best_r = None, 0.0
        for target in targets:
            t = _letters(target)
            for i in self.items:
                txt = _letters(i.text)
                if len(t) <= 7:
                    r = 1.0 if txt == t else 0.0
                    if r and len(txt) != len(t):
                        r = 0.0
                else:
                    if len(txt) < len(t) - 4:
                        continue
                    r = SequenceMatcher(None, txt[: len(t) + 2], t).ratio()
                    if r < threshold:
                        r = 0.0
                if r > best_r:
                    best, best_r = i, r
        return best

    def region(self, x0=-1e9, x1=1e9, y0=-1e9, y1=1e9):
        return sorted(
            (i for i in self.items if i.x0 >= x0 and i.x1 <= x1 and i.cy >= y0 and i.cy <= y1),
            key=lambda i: (round(i.cy / (max(i.h, 1) * 0.6)), i.x0),
        )

    def below(self, label, max_rows=2.6, min_rows=0.35, x_pad=(-12, 140)):
        """Items just under `label` in the same column."""
        h = max(label.h, 12)
        return sorted(
            (i for i in self.items
             if i is not label
             and label.y1 + (min_rows - 1) * h <= i.y0 + 0.0 <= label.y1 + max_rows * h
             and i.y0 > label.y0 + 0.3 * h
             and label.x0 + x_pad[0] <= i.x0 <= label.x0 + x_pad[1]),
            key=lambda i: (i.y0, i.x0),
        )


def _letters(t):
    return re.sub(r"[^a-z0-9]", "", t.lower())


def _norm_text(t):
    return re.sub(r"[^A-Za-z0-9/.&()]", "", t)


# --------------------------------------------------------------- extract ---

_STOP_ADDR = re.compile(r"^(mob|gstin|gst\s*no|st\w{2,4}\s*name|msme|cin\s*[UL]\d|e-?\s?mail|pan\b|udyam|code\s*:|place\s*of\s*supply)", re.I)
_LABELS = re.compile(r"motor|vehicle|terms|bill\s*of|delivery|dispatch|destination|mode|reference|other|buyer", re.I)


def _block_lines(items):
    """Group a block's items into text lines (same row -> joined left to right)."""
    lines, cur, cur_y = [], [], None
    for i in sorted(items, key=lambda i: (i.cy, i.x0)):
        if cur and abs(i.cy - cur_y) <= max(6, i.h * 0.3):
            cur.append(i)
        else:
            if cur:
                lines.append(cur)
            cur, cur_y = [i], i.cy
    if cur:
        lines.append(cur)
    return [" ".join(i.text for i in sorted(l, key=lambda i: i.x0)) for l in lines]


def _party(lines):
    """name, address lines, mobile, gstin(valid?) from a Consignee/seller block."""
    name = tidy(lines[0]) if lines else None
    addr, mobile = [], None
    gstin = (None, "unverified")
    for ln in lines[1:]:
        m = re.search(r"Mob\w*\W{0,3}(\d[\d\s]{8,12}\d)", ln, re.I)
        if m:
            mobile = re.sub(r"\D", "", m.group(1))[:10]
            continue
        g = find_gstin(ln)
        if g[0] and gstin[0] is None:
            gstin = g
            continue
        if _STOP_ADDR.match(tidy(ln)):
            continue
        if not addr or True:
            addr.append(tidy(ln))
    return name, addr, mobile, gstin


def extract(boxes):
    page = Page(boxes)
    fields, extra, warn = {}, {}, []
    if not page.items:
        return {"fields": {}, "extra": {}, "warnings": ["no text found"]}

    inv_label = page.anchor_any(["invoiceno", "invoicenumber", "invno"])
    ack = next(iter(page.find(r"AckDate")), None)
    cons_lbl = page.anchor_any(["consigneeshipto", "shipto", "deliveryaddressshipto", "shippedto", "consignee"])
    buyer_lbl = page.anchor_any(["buyerbillto", "billto", "billedto", "buyer"], 0.72)
    desc_hdr = page.anchor_any(["descriptionofgoods", "descriptionofgoodsandservices", "particulars", "itemdescription"])
    title = next(iter(page.find(r"^TaxInvoice")), None)

    # left edge of the right-hand column of header boxes (Invoice No., Delivery Note, ...)
    col_lbl = inv_label or next(iter(page.find(r"^DeliveryNote|^Buyer.?sOrder|^DispatchDoc")), None)
    col_x0 = col_lbl.x0 if col_lbl else None

    left_x1 = (col_x0 - 12) if col_x0 is not None else 1e9

    # ---- seller (consignor): the block above the first party label ----
    # (not every invoice has an "Ack Date" or a separate "Consignee (Ship to)" block)
    first_party = min((l.y0 for l in (cons_lbl, buyer_lbl) if l is not None), default=None)
    if first_party is not None and (ack or title or inv_label):
        top = (ack.y1 if ack else title.y1 if title else inv_label.y0) + 4
        block = [i for i in page.region(x1=left_x1, y0=top, y1=first_party - 2)]
        lines = _block_lines(block)
        if lines:
            name, addr, _, gst = _party(lines)
            addr = addr[:4]
            fields["consignorAddress"] = "\n".join([clean_company(name)] + addr) if name else None
            if gst[0]:
                fields["consignorGstin"] = gst[0]
                w = _gstin_warning("consignorGstin", gst[1])
                if w:
                    warn.append(w)

    # ---- consignee: the "Consignee (Ship to)" block, or (when the invoice has none) the Buyer (Bill to) ----
    party_lbl, bottom = None, None
    if cons_lbl:
        party_lbl = cons_lbl
        bottom = buyer_lbl.y0 - 2 if buyer_lbl else cons_lbl.y1 + 200
    elif buyer_lbl:
        party_lbl = buyer_lbl
        bottom = (desc_hdr.y0 - 2) if desc_hdr else buyer_lbl.y1 + 260
        warn.append("consignee: this invoice has no Ship-to block, so the Buyer (Bill to) was used - please check it")
    if party_lbl:
        block = page.region(x1=left_x1, y0=party_lbl.y1 - 1, y1=bottom)
        lines = _block_lines(block)
        if lines:
            name, addr, mobile, gst = _party(lines)
            fields["consigneeAddress"] = "\n".join([name] + addr) if name else None
            if mobile:
                fields["phoneNo"] = mobile
            if gst[0]:
                fields["consigneeGstin"] = gst[0]
                w = _gstin_warning("consigneeGstin", gst[1])
                if w:
                    warn.append(w)

    # ---- invoice no / date / e-way ----
    val = None
    if inv_label:
        row = page.below(inv_label, max_rows=2.2, x_pad=(-15, 25))
        val = row[0] if row else None
    elif col_lbl:
        h = max(col_lbl.h, 12)
        above = [i for i in page.items if i is not col_lbl and col_lbl.x0 - 15 <= i.x0 <= col_lbl.x0 + 25
                 and col_lbl.y0 - 2.6 * h <= i.y0 < col_lbl.y0 - 0.2 * h]
        val = max(above, key=lambda i: i.y0) if above else None
    if val:
        fields["invoiceNoDate"] = clean_invoice_no(val.text)
        same_row = [i for i in page.items if abs(i.cy - val.cy) < max(10, val.h * 0.8) and i.x0 > val.x0 - 2]
        joined = " ".join(i.text for i in sorted(same_row, key=lambda i: i.x0))
        m = re.search(r"(\d{12})\s*(\d{1,2}\s?-\s?[A-Za-z]{3}\s?-\s?\d{2})", joined)
        if m:
            extra["ewayBill"] = m.group(1)
            fields["invoiceDate"] = to_iso(m.group(2))
        else:
            d = to_iso(joined)
            if d:
                fields["invoiceDate"] = d
            e = re.search(r"\b(\d{12})\b", joined)
            if e:
                extra["ewayBill"] = e.group(1)
    if "invoiceDate" not in fields and ack:
        fields["invoiceDate"] = to_iso(ack.text) or fields.get("invoiceDate")

    # ---- vehicle, LR, destination (right-hand column labels) ----
    veh_lbl = page.anchor_any(["motorvehicleno", "vehicleno", "vehiclenumber", "truckno", "lorryno"])
    if veh_lbl:
        for i in page.below(veh_lbl, max_rows=2.4, x_pad=(-15, 60)):
            m = VEHICLE_RE.search(i.text.upper())
            if m:
                fields["lorryNo"] = "".join(m.groups())
                break
    if "lorryNo" not in fields:
        m = VEHICLE_RE.search(" ".join(i.text.upper() for i in page.items))
        if m:
            fields["lorryNo"] = "".join(m.groups())
            warn.append("lorryNo: found without its label, please verify")

    lr_lbl = page.anchor_any(["billofladinglrrrno", "lrno", "lrrrno", "lorryreceiptno", "grno"])
    if lr_lbl:
        for i in page.below(lr_lbl, max_rows=2.4, x_pad=(-15, 60)):
            m = LR_RE.search(i.text)
            if m:
                extra["lrNo"] = m.group(1)
                d = to_iso(m.group(2))
                if d:
                    fields["biltyDate"] = d
                break

    dest_lbl = page.anchor_any(["destination", "placeofdelivery", "deliveryplace"], 0.85)
    if dest_lbl:
        limit = (veh_lbl.y0 - 3) if veh_lbl else dest_lbl.y1 + 3 * dest_lbl.h
        for i in page.below(dest_lbl, max_rows=2.2, x_pad=(-15, 60)):
            if i.y0 < limit and not _LABELS.search(i.text) and re.search(r"[A-Za-z]{3}", i.text):
                fields["to"] = tidy(i.text).title()
                break

    # ---- totals: the "Total" row that carries a quantity (pieces, kg, ...) ----
    if desc_hdr:
        for t in page.find(r"^Total", below=desc_hdr.y1):
            row = [i for i in page.items if abs(i.cy - t.cy) < max(10, t.h * 0.8)]
            joined = " ".join(i.text for i in sorted(row, key=lambda i: i.x0))
            # first quantity in pieces or weight (an area like "1,591.075 SQM" can sit right next to it)
            qty = next((m for m in QTY_RE.finditer(joined)
                        if m.group(2).upper() in _PIECE_UNITS or m.group(2).upper() in _WEIGHT_UNITS), None)
            if not qty:
                continue          # e.g. the tax-summary "Total" row has amounts but no quantity
            unit = qty.group(2).upper()
            if unit in _PIECE_UNITS:
                fields["packages"] = str(int(float(qty.group(1).replace(",", ""))))
            elif unit in _WEIGHT_UNITS:
                fields["actualWt"] = f"{_num(qty.group(1))} {_WEIGHT_UNITS[unit]}"
            # The grand total is printed in the same band as the "Total" label,
            # but photo perspective can shift it up or down by a line, so take
            # the largest money amount in a small band (never a quantity).
            window = [i for i in page.items if t.cy - 26 <= i.cy <= t.cy + 30 and i.x0 > t.x1
                      and not UNIT_WORD.search(i.text)]
            cands = [c for i in window for c in parse_amounts(i.text)]
            if cands:
                v, well_formed = max(cands, key=lambda c: c[0])
                fields["declaredValue"] = str(int(v)) if v == int(v) else f"{v:.2f}"
                if not well_formed:
                    warn.append("declaredValue: the total looked garbled in the photo, please verify")
            break

        # ---- goods description: a short summary of the item lines ----
        end = None
        for stop in page.find(r"^(OUTPUT|IGST|CGST|Total)", below=desc_hdr.y1 + 20):
            end = stop.y0
            break
        region = page.region(x1=desc_hdr.x1 + 60,   # item names can sit well left of the header text
                             y0=desc_hdr.y1 + 8, y1=(end or desc_hdr.y1 + 600))
        names = [i.text for i in region
                 if re.search(r"(mm|plywood|ply|board|door|block)", i.text, re.I) and re.search(r"[A-Za-z]{3}", i.text)]
        kinds = []
        for n in names:
            low = n.lower()
            kind = ("Block Board" if "block board" in low else "Flush Door" if "door" in low
                    else "Plywood" if "ply" in low else None)
            if kind and kind not in kinds:
                kinds.append(kind)
        if kinds:
            fields["description"] = " / ".join(kinds)
        else:
            # any other goods: the first item's name ("1 ADF R-105" -> "ADF R-105")
            for i in region:
                name = re.sub(r"^\d+\s+", "", i.text.strip())
                if (re.search(r"[A-Za-z]{3}", name) and not name.startswith("(") and len(name) <= 40
                        and not re.match(r"(?i)(no\.?|sl\b|description|hsn|quantity|rate|per|amount|output|total)", name)):
                    fields["description"] = name
                    break
        # "(280 BAGS X 25 KGS)" in the item text -> number of packages and how they are packed
        for i in region:
            m = PACKS_RE.search(i.text)
            if m:
                fields.setdefault("packages", m.group(1))
                unit = m.group(2).title()
                fields["methodOfPacking"] = unit if unit.endswith("s") else unit + "s"
                break

    fields = {k: v for k, v in fields.items() if v}
    anchors = sum(1 for a in (inv_label, cons_lbl, buyer_lbl, desc_hdr, veh_lbl) if a is not None)
    return {"fields": fields, "extra": extra, "warnings": warn, "tilt": round(page.tilt, 2), "anchors": anchors}
