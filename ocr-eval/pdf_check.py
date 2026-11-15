#!/usr/bin/env python3
"""Check the bill reader on digital (Tally) PDF invoices, using each PDF's own
e-way bill page as the correct answer.

The e-way bill page holds the same facts in a fixed, structured form (invoice
no., date, both GSTINs, vehicle, quantity, total, ship-to town), so it is a
check that does not depend on the layout rules being tested.

  python3 pdf_check.py <folder with the PDFs> [--verbose]

Customer PDFs are never stored in the repo: pass a folder outside it.
"""
import glob, os, re, subprocess, sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ocr-service"))
import pdf_reader  # noqa: E402


def text_of(path):
    return subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout


def iso(d):
    for fmt in ("%d-%b-%y", "%d-%b-%Y"):
        try:
            return datetime.strptime(d.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass


def num(s):
    return float(s.replace(",", ""))


def truth_from(text):
    """Correct values read from the e-way bill section (None when not there)."""
    t = {}
    m = re.search(r"Doc No\.\s*:\s*Tax Invoice\s*-\s*(\S+)\s*\n\s*Date\s*:\s*(\S+)", text)
    if m:
        t["invoiceNo"], t["invoiceDate"] = m.group(1), iso(m.group(2))
    m = re.search(r"From\s+To\s*\n\s*(.+?)\s{3,}(.+)\n\s*GSTIN\s*:\s*(\w{15})\s+GSTIN\s*:\s*(\w{15})", text)
    if m:
        t["sellerName"], t["consigneeName"] = m.group(1).strip(), m.group(2).strip()
        t["sellerGstin"], t["consigneeGstin"] = m.group(3), m.group(4)
    m = re.search(r"5\. Vehicle Details\s*\n\s*Vehicle No\.\s*:\s*(\w+)", text)
    if m:
        t["vehicleNo"] = m.group(1)
    m = re.search(r"Total Inv Amt\s*:\s*([\d,]+\.\d\d)", text)
    if m:
        t["totalAmount"] = num(m.group(1))
    goods = text.split("3. Goods Details")[-1].split("Tot.Taxable")[0] if "3. Goods Details" in text else ""
    qty = re.findall(r"([\d,]+(?:\.\d+)?)\s*(KGS?|MTS?|PCS|NOS)\b", goods, re.I)
    units = {u.upper().rstrip("S") for _, u in qty}
    if qty and len(units) == 1:
        t["quantity"] = sum(num(q) for q, _ in qty)
        t["unit"] = units.pop()
    return t


def norm(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def checks(pred, t):
    """field -> True/False/None (None = no answer to check against)."""
    out = {}
    out["invoice no"] = norm(pred.get("invoiceNoDate")).endswith(norm(t["invoiceNo"]).lstrip("0")) if "invoiceNo" in t and pred.get("invoiceNoDate") else (False if "invoiceNo" in t else None)
    out["invoice date"] = pred.get("invoiceDate") == t["invoiceDate"] if "invoiceDate" in t else None
    out["consignor gstin"] = pred.get("consignorGstin") == t["sellerGstin"] if "sellerGstin" in t else None
    out["consignee gstin"] = pred.get("consigneeGstin") == t["consigneeGstin"] if "consigneeGstin" in t else None
    out["consignee name"] = (norm(t["consigneeName"])[:12] in norm(pred.get("consigneeAddress"))) if "consigneeName" in t else None
    out["vehicle no"] = norm(pred.get("lorryNo")) == norm(t["vehicleNo"]) if "vehicleNo" in t else None
    out["total amount"] = (num(pred["declaredValue"]) == t["totalAmount"]) if "totalAmount" in t and pred.get("declaredValue") else (False if "totalAmount" in t else None)
    if "quantity" in t and t["unit"].startswith("KG"):
        m = re.match(r"([\d.]+)\s*KG", pred.get("actualWt") or "")
        out["weight (kg)"] = bool(m) and abs(float(m.group(1)) - t["quantity"]) < 0.5
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder, verbose = sys.argv[1], "--verbose" in sys.argv
    skipped = 0
    stats, files = {}, sorted(glob.glob(os.path.join(folder, "**", "*.pdf"), recursive=True))
    for f in files:
        t = truth_from(text_of(f))
        if "invoiceNo" not in t:
            skipped += 1      # no e-way bill page in this PDF: nothing independent to check against
            continue
        pred = pdf_reader.read_pdf(open(f, "rb").read())["fields"]
        for k, ok in checks(pred, t).items():
            if ok is None:
                continue
            stats.setdefault(k, [0, 0])[0 if ok else 1] += 1
            if not ok and verbose:
                print(f"  WRONG {os.path.basename(f)} {k}: got {pred}")
    print(f"{'field':<18}{'right':>7}{'wrong':>7}")
    tr = tw = 0
    for k, (r, w) in stats.items():
        print(f"{k:<18}{r:>7}{w:>7}")
        tr, tw = tr + r, tw + w
    print(f"{'ALL':<18}{tr:>7}{tw:>7}   {100 * tr / max(tr + tw, 1):.1f}% of {tr + tw} checks on {len(files) - skipped} PDFs ({skipped} PDFs without an e-way bill page skipped)")


if __name__ == "__main__":
    main()
