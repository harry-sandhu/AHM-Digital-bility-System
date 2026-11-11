#!/usr/bin/env python3
"""Builds test sets with known correct values (all under data/, git-ignored).

  make_dataset.py aug   N   N random "bad photo" versions of each of the 18 real photos
  make_dataset.py synth N   N generated invoices (varied layouts/wording) turned into photos
"""
import base64
import json
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ocr-service"))
from gstin import check_char  # noqa: E402
from photo_effects import photo_effects  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = f"{HERE}/data"


# --------------------------------------------------------------------- aug --
def make_aug(n):
    out = f"{DATA}/aug"; os.makedirs(out, exist_ok=True)
    truth = json.load(open(f"{DATA}/truth.json"))
    new_truth, meta = {}, {}
    rng = random.Random(1234)
    for name, t in truth.items():
        src = Image.open(f"{DATA}/{name}").convert("RGB")
        from PIL import ImageOps
        src = ImageOps.exif_transpose(src)
        for i in range(n):
            level = rng.choice(["light", "normal", "normal", "harsh"])
            _, p, raw = photo_effects(src, rng, level)
            fn = f"{name[:-5]}_a{i:02d}.jpg"
            open(f"{out}/{fn}", "wb").write(raw)
            new_truth[fn] = t
            meta[fn] = {"source": name, "level": level, **p}
    json.dump(new_truth, open(f"{out}/truth.json", "w"), indent=1)
    json.dump(meta, open(f"{out}/meta.json", "w"), indent=1)
    print(f"{len(new_truth)} augmented photos -> {out}")


# ------------------------------------------------------------------- synth --
FONTS = {
    "sans": ("/usr/share/fonts/noto/NotoSans-Regular.ttf", "/usr/share/fonts/noto/NotoSans-Bold.ttf"),
    "serif": ("/usr/share/fonts/noto/NotoSerif-Regular.ttf", "/usr/share/fonts/noto/NotoSerif-Bold.ttf"),
}
STATES = {"Uttar Pradesh": "09", "Rajasthan": "08", "Haryana": "06", "Punjab": "03", "Delhi": "07", "Uttarakhand": "05",
          "Gujarat": "24", "Maharashtra": "27", "Bihar": "10", "Madhya Pradesh": "23"}
CITIES = {"Uttar Pradesh": ["Meerut", "Agra", "Moradabad", "Ballia", "Kanpur", "Lucknow"],
          "Rajasthan": ["Bhilwara", "Jaipur", "Alwar", "Kota"], "Haryana": ["Yamunanagar", "Ambala", "Panipat"],
          "Punjab": ["Ludhiana", "Amritsar", "Jalandhar"], "Delhi": ["Mundka", "Laxmi Nagar", "Narela"],
          "Uttarakhand": ["Haridwar", "Rudrapur", "Kashipur"], "Gujarat": ["Surat", "Rajkot"],
          "Maharashtra": ["Pune", "Nagpur"], "Bihar": ["Patna", "Gaya"], "Madhya Pradesh": ["Indore", "Bhopal"]}
NAMES = ["Shree Ganesh Traders", "Krishna Enterprises", "Sharma Plywood House", "Jai Mata Di Plywood", "Verma Timber & Ply",
         "Anand Building Solutions", "Goyal Wood Industries", "Sai Baba Hardware", "Mahavir Packaging Industries",
         "New Bharat Furnitures", "Gupta Laminates Pvt. Ltd.", "Singh Brothers", "Royal Decor And Co", "Balaji Timber Mart",
         "Om Sai Plywood", "Kumar Enterprises", "Khanna Wood Works", "Patel Panel Products"]
STREETS = ["Plot No. {n}, Industrial Area", "{n}/{m}, Main Market Road", "Shop No. {n}, Timber Market", "Khasra No. {n}, Ganj Road",
           "{n}, Civil Lines", "Near Bus Stand, GT Road", "Ground Floor, {n}/{m} Mandi Road", "Village Road, Near {n} Chowk"]
SELLERS = [
    ("M B Plywood Industries (P) Ltd. (2026-27)", ["PO Danpur, Rudrapur ( U.S. Nagar)"], "Uttarakhand", "mbplywoodindustries@gmail.com", "MSME UK-12-0003966"),
    ("Naini Plywood Pvt. Ltd.", ["Lalpur, Kichha Road, Rudrapur"], "Uttarakhand", "nainiplywood@gmail.com", "CIN U2019UP1986PTC008056"),
    ("Himalaya Timber Works Pvt. Ltd.", ["Plot 14, SIDCUL Industrial Area, Kashipur"], "Uttarakhand", "himalayatimber@gmail.com", "MSME UK-09-0011223"),
    ("Sagar Boards & Laminates", ["Kh. No. 88, Bareilly Road, Moradabad"], "Uttar Pradesh", "sagarboards@gmail.com", ""),
]
GOODS = [("Plywood", "{t}mm Plywood {a:.3f}x{b:.3f}", 44123190), ("Comm Plywood", "{t} MM Comm Plywood Bsc ({a:.2f}*{b:.2f})", 44123210),
         ("Block Board", "{t} MM Block Board Bsc ({a:.2f}*{b:.2f})", 44129400)]
# label wording: the first two entries are what real invoices use; the rest are "unfamiliar"
WORDING = {
    "invoice": ["Invoice No.", "Invoice No.", "Invoice Number", "Inv. No."],
    "ship": ["Consignee (Ship to)", "Consignee (Ship to)", "Ship To", "Consignee (Ship To)", "Delivery Address (Ship to)"],
    "bill": ["Buyer (Bill to)", "Buyer (Bill to)", "Bill To", "Buyer (Bill To)"],
    "vehicle": ["Motor Vehicle No.", "Motor Vehicle No.", "Vehicle No.", "Truck No."],
    "lr": ["Bill of Lading/LR-RR No.", "Bill of Lading/LR-RR No.", "LR No.", "L.R. No."],
    "desc": ["Description of Goods", "Description of Goods", "Particulars", "Description of Goods and Services"],
    "dest": ["Destination", "Destination", "Destination", "Place of Delivery"],
}


def gstin(rng, state_code):
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    body = state_code + "".join(rng.choice(letters) for _ in range(5)) + "".join(rng.choice("0123456789") for _ in range(4)) \
        + rng.choice(letters) + rng.choice("123456789") + "Z"
    return body + check_char(body)


def inr(x, dec=2):
    s = f"{x:.{dec}f}"; whole, _, frac = s.partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:]); head = head[:-2]
        if head: parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return whole + ("." + frac if dec else "")


def render_invoice(rng, idx):
    W, H = 1240, 1754
    fam = rng.choice(["sans", "sans", "serif"])
    reg, bold = FONTS[fam]
    fs = rng.randint(21, 26)
    F = lambda s=0, b=False: ImageFont.truetype(bold if b else reg, fs + s)
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    var = {"font": fam, "fs": fs}

    # wording choices (index >= 2 means "unfamiliar")
    wd = {k: rng.choice(v) if rng.random() < 0.45 else v[0] for k, v in WORDING.items()}
    var["wording"] = {k: v for k, v in wd.items() if v not in WORDING[k][:2]}
    shuffle_rows = rng.random() < 0.3
    var["rows_shuffled"] = shuffle_rows

    seller = rng.choice(SELLERS); s_name, s_addr, s_state, s_mail, s_extra = seller
    s_gstin = gstin(rng, STATES[s_state])
    state = rng.choice(list(STATES)); city = rng.choice(CITIES[state]); name = rng.choice(NAMES)
    caps = rng.random() < 0.35
    street = rng.choice(STREETS).format(n=rng.randint(1, 250), m=rng.randint(1, 99))
    pin = rng.randint(110001, 849999)
    addr_lines = [street, f"{city}, {state}" + (f", {pin}" if rng.random() < .5 else f"-{pin}")]
    if rng.random() < 0.4:
        addr_lines.insert(1, rng.choice(["Opp. Old Bus Stand", "Near Railway Crossing", "Behind Main Market"]))
    if caps:
        name_s, addr_s = name.upper(), [l.upper() for l in addr_lines]
    else:
        name_s, addr_s = name, addr_lines
    has_mob = rng.random() < 0.5; mob = str(rng.choice([6, 7, 8, 9])) + "".join(rng.choice("0123456789") for _ in range(9))
    has_ship_gstin = rng.random() < 0.85; c_gstin = gstin(rng, STATES[state])
    has_dest = rng.random() < 0.5
    vehicle = f"{rng.choice(['UP','RJ','HR','PB','DL','UK'])}{rng.randint(10,99)}{rng.choice(['AB','BT','CA','GV','F','T'])}{rng.randint(1000,9999)}"
    inv_no = rng.choice([str(rng.randint(100, 999)), f"S/26-27/{rng.randint(10, 400)}", f"INV/{rng.randint(1000,9999)}"])
    day, mon = rng.randint(1, 28), rng.randint(1, 12); date_iso = f"2026-{mon:02d}-{day:02d}"
    mon3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][mon - 1]
    date_s = f"{day}-{mon3}-26"; eway = "".join(rng.choice("0123456789") for _ in range(12))
    lr_no = str(rng.randint(5000, 7999))
    complete = rng.random() < 0.55
    n_items = rng.randint(1, 7) if complete else rng.randint(4, 8)
    items, tot_pcs, tot_amt = [], 0, 0.0
    kind = rng.choice(GOODS)
    for _ in range(n_items):
        pcs = rng.randint(20, 400); rate = rng.choice([110, 130, 170, 230, 585, 700, 861.12, 1001.05])
        a, b = rng.choice([(2.44, 1.22), (1.84, 0.92), (2.14, 0.71), (2.54, 1.02)]); t = rng.choice([6, 9, 12, 18, 19, 25, 31])
        sqm = pcs * a * b; amt = round(sqm * rate, 2)
        items.append((kind[1].format(t=t, a=a, b=b), kind[2], pcs, sqm, rate, amt)); tot_pcs += pcs; tot_amt += amt
    igst = round(tot_amt * 0.18, 2); grand_exact = tot_amt + igst; grand = round(grand_exact); rounding = round(grand - grand_exact, 2)

    # ---- header ----
    d.text((W / 2, 55), "Tax Invoice", font=F(8, True), fill="black", anchor="mm")
    d.text((W / 2 + 230, 58), "(ORIGINAL FOR RECIPIENT)", font=F(-6), fill="black", anchor="lm")
    d.text((W - 150, 58), "e-Invoice", font=F(-6, True), fill="black", anchor="lm")
    irn = "".join(rng.choice("0123456789abcdef") for _ in range(64))
    d.text((70, 150), "IRN", font=F(-4), fill="black"); d.text((170, 150), ": " + irn[:46] + "-", font=F(-8), fill="black")
    d.text((190, 176), irn[46:], font=F(-8), fill="black")
    d.text((70, 205), "Ack No.", font=F(-4), fill="black"); d.text((170, 205), ": 1326" + "".join(rng.choice("0123456789") for _ in range(11)), font=F(-6, True), fill="black")
    d.text((70, 235), "Ack Date", font=F(-4), fill="black"); d.text((170, 235), f": {date_s}", font=F(-6, True), fill="black")

    has_qr = rng.random() < 0.7; var["qr"] = has_qr
    if has_qr:
        import zxingcpp
        inner = {"SellerGstin": s_gstin, "BuyerGstin": c_gstin, "DocNo": inv_no, "DocTyp": "INV", "DocDt": f"{day:02d}/{mon:02d}/2026",
                 "TotInvVal": grand, "ItemCnt": n_items, "MainHsnCode": str(items[0][1]), "Irn": irn}
        b64 = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
        jwt = ".".join([b64({"alg": "RS256", "typ": "JWT"}), b64({"data": json.dumps(inner), "iss": "NIC"}), b64("sig" * 60)])
        bm = zxingcpp.write_barcode(zxingcpp.BarcodeFormat.QRCode, jwt, width=0, height=0, ec_level=2)  # noqa
        qa = np.array(bm); qimg = Image.fromarray(qa).convert("L").resize((240, 240), Image.NEAREST)
        img.paste(qimg, (W - 70 - 240, 85))

    # ---- left column ----
    X0, X1 = 70, W - 70; table_top = 345
    split = rng.uniform(0.50, 0.62); XS = int(X0 + (X1 - X0) * split); var["split"] = round(split, 2)
    y = table_top + 12
    lh = fs + 9
    d.text((X0 + 12, y), s_name, font=F(2, True), fill="black"); y += lh
    for l in s_addr: d.text((X0 + 12, y), l, font=F(), fill="black"); y += lh
    if s_extra: d.text((X0 + 12, y), s_extra, font=F(-2), fill="black"); y += lh
    d.text((X0 + 12, y), f"GSTIN/UIN: {s_gstin}", font=F(), fill="black"); y += lh
    d.text((X0 + 12, y), f"State Name :  {s_state}, Code : {STATES[s_state]}", font=F(), fill="black"); y += lh
    d.text((X0 + 12, y), f"E-Mail : {s_mail}", font=F(), fill="black"); y += lh + 4
    d.line([(X0, y), (XS, y)], fill="black", width=2)
    d.text((X0 + 12, y + 4), wd["ship"], font=F(-3), fill="black"); y += lh + 4
    ship_top = y
    d.text((X0 + 12, y), name_s, font=F(1, True), fill="black"); y += lh
    for l in addr_s: d.text((X0 + 12, y), l, font=F(), fill="black"); y += lh
    if has_mob: d.text((X0 + 12, y), f"Mob-{mob}", font=F(), fill="black"); y += lh
    if has_ship_gstin:
        d.text((X0 + 12, y), "GSTIN/UIN", font=F(), fill="black"); d.text((X0 + 190, y), f": {c_gstin}", font=F(), fill="black"); y += lh
    d.text((X0 + 12, y), "State Name", font=F(), fill="black"); d.text((X0 + 190, y), f": {state}, Code : {STATES[state]}", font=F(), fill="black"); y += lh + 4
    d.line([(X0, y), (XS, y)], fill="black", width=2)
    d.text((X0 + 12, y + 4), wd["bill"], font=F(-3), fill="black"); y += lh + 4
    d.text((X0 + 12, y), name_s, font=F(1, True), fill="black"); y += lh
    for l in addr_s: d.text((X0 + 12, y), l, font=F(), fill="black"); y += lh
    if has_mob: d.text((X0 + 12, y), f"Mob-{mob}", font=F(), fill="black"); y += lh
    d.text((X0 + 12, y), "GSTIN/UIN", font=F(), fill="black"); d.text((X0 + 190, y), f": {c_gstin}", font=F(), fill="black"); y += lh
    d.text((X0 + 12, y), "State Name", font=F(), fill="black"); d.text((X0 + 190, y), f": {state}, Code : {STATES[state]}", font=F(), fill="black"); y += lh + 6
    left_bottom = y

    # ---- right grid ----
    rows = [(wd["invoice"], "e-Way Bill No.", "Dated"), ("Delivery Note", "Mode/Terms of Payment", None),
            ("Reference No. & Date.", "Other References", None), ("Buyer's Order No.", "Dated", None),
            ("Dispatch Doc No.", "Delivery Note Date", None), ("Dispatched through", wd["dest"], None),
            (wd["lr"], wd["vehicle"], None), ("Terms of Delivery", None, None)]
    if shuffle_rows:
        mid = rows[1:]; rng.shuffle(mid); rows = [rows[0]] + mid
    xm = XS + (X1 - XS) * 0.5; rh = max(58, int((left_bottom - table_top) / len(rows)))
    for i, (a, b, c) in enumerate(rows):
        ry = table_top + i * rh
        d.line([(XS, ry), (X1, ry)], fill="black", width=1)
        d.text((XS + 8, ry + 4), a, font=F(-4), fill="black")
        if b: d.text((xm + 8, ry + 4), b, font=F(-4), fill="black")
        if i == 0:
            d.text((XS + 8, ry + 30), inv_no, font=F(0, True), fill="black")
            d.text((XS + 8 + 140, ry + 30), eway, font=F(-6, True), fill="black") if False else None
            d.text((xm - 30, ry + 30), eway, font=F(-6, True), fill="black")
            d.text((xm + 150, ry + 4), c, font=F(-4), fill="black"); d.text((xm + 150, ry + 30), date_s, font=F(-1, True), fill="black")
        if a == wd["lr"]:
            d.text((XS + 8, ry + 30), f"{lr_no} dt. {date_s}", font=F(-1, True), fill="black")
        if b == wd["vehicle"]:
            d.text((xm + 8, ry + 30), vehicle, font=F(-1, True), fill="black")
        if b == wd["dest"] and has_dest:
            d.text((xm + 8, ry + 30), city.upper(), font=F(-1, True), fill="black")
    d.rectangle([X0, table_top, X1, left_bottom], outline="black", width=2); d.line([(XS, table_top), (XS, left_bottom)], fill="black", width=2)

    # ---- items ----
    ty = left_bottom + 12
    cols = {"si": X0 + 8, "desc": X0 + 90, "hsn": X0 + 560, "qty": X0 + 700, "rate": X0 + 850, "amt": X1 - 170}
    d.line([(X0, ty), (X1, ty)], fill="black", width=2)
    d.text((cols["si"], ty + 6), "SI", font=F(-4), fill="black"); d.text((cols["desc"], ty + 6), wd["desc"], font=F(-2), fill="black")
    for k, t in (("hsn", "HSN/SAC"), ("qty", "Quantity"), ("rate", "Rate"), ("amt", "Amount")):
        d.text((cols[k], ty + 6), t, font=F(-3), fill="black")
    ty += 44; d.line([(X0, ty), (X1, ty)], fill="black", width=1); ty += 12
    for n, (desc, hsn, pcs, sqm, rate, amt) in enumerate(items, 1):
        d.text((cols["si"], ty), str(n), font=F(-2), fill="black"); d.text((cols["desc"], ty), desc, font=F(0, True), fill="black")
        d.text((cols["hsn"], ty), str(hsn), font=F(-2), fill="black"); d.text((cols["qty"], ty), f"{pcs}.00 Pcs", font=F(-1, True), fill="black")
        d.text((cols["qty"], ty + 24), f"({inr(sqm)} Sqmt.)", font=F(-8), fill="black")
        d.text((cols["rate"], ty), f"{inr(rate)}", font=F(-2), fill="black")
        d.text((X1 - 20, ty), inr(amt), font=F(-1, True), fill="black", anchor="ra"); ty += 58
    d.text((X1 - 20, ty + 4), inr(tot_amt), font=F(-1), fill="black", anchor="ra")
    d.text((cols["desc"] + 160, ty + 40), "OUTPUT IGST", font=F(-1, True), fill="black"); d.text((cols["rate"] + 20, ty + 40), "18 %", font=F(-2), fill="black")
    d.text((X1 - 20, ty + 40), inr(igst), font=F(-1, True), fill="black", anchor="ra")
    if abs(rounding) > 0: d.text((X1 - 20, ty + 76), f"{rounding:.2f}", font=F(-2), fill="black", anchor="ra")
    ty += 150
    if complete:
        d.line([(X0, ty), (X1, ty)], fill="black", width=1)
        d.text((cols["desc"] + 330, ty + 8), "Total", font=F(-1), fill="black", anchor="ra")
        d.text((cols["qty"], ty + 8), f"{tot_pcs}.00 Pcs", font=F(-1, True), fill="black")
        d.text((X1 - 20, ty + 8), "₹ " + inr(grand), font=F(1, True), fill="black", anchor="ra"); ty += 54
        d.text((X0 + 8, ty), "Amount Chargeable (in words)", font=F(-5), fill="black")
    else:
        d.text((X1 - 20, ty + 8), "continued to page number 2", font=F(-3), fill="black", anchor="ra")
    d.text((W / 2, ty + 100), "This is a Computer Generated Invoice", font=F(-4), fill="black", anchor="mm")

    truth = dict(invoiceNo=inv_no, invoiceDate=date_iso, ewayBill=eway, sellerName=s_name, sellerGstin=s_gstin,
                 consigneeName=name_s, consigneeAddress=", ".join([name_s] + addr_s) if False else ", ".join(addr_s),
                 consigneeGstin=c_gstin if has_ship_gstin else None, consigneeMobile=mob if has_mob else None,
                 vehicleNo=vehicle, lrNo=lr_no, destination=city if has_dest else "",
                 totalPcs=tot_pcs if complete else None, totalAmount=float(grand) if complete else None, pageComplete=complete)
    var.update(complete=complete, caps=caps, has_mob=has_mob, has_ship_gstin=has_ship_gstin, has_dest=has_dest, n_items=n_items, seller=s_name[:12])
    return img, truth, var


def make_synth(n, mode="synth"):
    """mode: synth (mixed bad photos) | synthphoto (decent phone photos) | synthclean (no photo effects: layout only)"""
    out = f"{DATA}/{mode}"; os.makedirs(out, exist_ok=True)
    rng = random.Random({"synth": 777, "synthphoto": 778, "synthclean": 779}[mode]); truth_all, meta = {}, {}
    for i in range(n):
        page, truth, var = render_invoice(rng, i)
        fn = f"syn{i:03d}.jpg"
        if mode == "synthclean":
            level, p = "none", {"scale": 1.0, "blur": 0, "jpeg": 95, "rotate": 0, "contrast": 1.0, "noise": 0, "shadow": 0}
            page.save(f"{out}/{fn}", quality=95)
        else:
            level = "mild" if mode == "synthphoto" else rng.choice(["light", "normal", "normal", "harsh"])
            _, p, raw = photo_effects(page, rng, level)
            open(f"{out}/{fn}", "wb").write(raw)
        if i < 3: page.save(f"{out}/clean_{i}.png")
        truth_all[fn] = truth; meta[fn] = {"level": level, **var, **p}
    json.dump(truth_all, open(f"{out}/truth.json", "w"), indent=1); json.dump(meta, open(f"{out}/meta.json", "w"), indent=1)
    print(f"{n} synthetic invoice photos -> {out}")


if __name__ == "__main__":
    kind, n = sys.argv[1], int(sys.argv[2])
    if kind == "aug":
        make_aug(n)
    else:
        make_synth(n, kind)
