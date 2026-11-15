#!/usr/bin/env python3
"""Builds a big set of phone-style photos from digital (Tally) PDF invoices, with correct answers.

  python3 pdf_dataset.py <folder with the PDFs> <N> [seed]      ->  data/pdfaug/  (git-ignored)

* answers come from each PDF's own e-way bill page (see pdf_check.py), so they do not depend on the
  reader being tested;
* every photo gets random rotation, perspective, shadow, blur, noise and JPEG damage
  (photo_effects.py), a random page size, and sometimes a steep extra tilt;
* about 8% are pages that are NOT an invoice page (the e-way bill page): nothing should be filled
  from them, so they test for made-up values.
Then:  python3 run_dataset.py pdfaug 6   and   python3 analyze.py pdfaug
"""
import glob, json, os, random, re, subprocess, sys, tempfile
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from photo_effects import photo_effects  # noqa: E402
from pdf_check import text_of, truth_from  # noqa: E402

OUT = f"{HERE}/data/pdfaug"
LEVELS = [("mild", 0.25), ("light", 0.25), ("normal", 0.33), ("harsh", 0.17)]


def answers(text):
    t = truth_from(text)
    if "invoiceNo" not in t:
        return None
    a = {"sellerName": t.get("sellerName"), "sellerGstin": t.get("sellerGstin"), "consigneeName": t.get("consigneeName"),
         "consigneeGstin": t.get("consigneeGstin"), "invoiceNo": t["invoiceNo"], "invoiceDate": t.get("invoiceDate"),
         "vehicleNo": t.get("vehicleNo"), "totalAmount": t.get("totalAmount"), "pageComplete": True}
    if t.get("unit", "").startswith("KG"):
        a["weightKg"] = t["quantity"]
    m = re.search(r"5\. Vehicle Details\s*\n\s*Vehicle No\.\s*:\s*\w+\s+From\s*:\s*(\S[^\n]*?)\s{2,}", text)
    if m:
        a["fromPlace"] = m.group(1).strip()
    return a


def render(pdf, page, dpi):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-png", pdf, f"{d}/p"], check=True, capture_output=True)
        return Image.open(sorted(glob.glob(f"{d}/p*.png"))[0]).convert("RGB")


def one(job):
    i, pdf, truth, seed = job
    rng = random.Random(seed * 100003 + i)
    negative = rng.random() < 0.08
    page = 2 if negative else 1
    try:
        img = render(pdf, page, rng.randint(100, 200))
    except Exception:
        return None
    extra = 0.0
    if rng.random() < 0.12:                      # a steep tilt on top of the usual one
        extra = rng.choice([-1, 1]) * rng.uniform(10, 25)
        img = img.rotate(extra, expand=True, fillcolor=(120, 120, 120), resample=Image.BICUBIC)
    level = rng.choices([l for l, _ in LEVELS], [w for _, w in LEVELS])[0]
    _, p, raw = photo_effects(img, rng, level)
    name = f"{os.path.splitext(os.path.basename(pdf))[0]}_{i:05d}.jpg"
    open(f"{OUT}/{name}", "wb").write(raw)
    return name, ({} if negative else truth), {"source": os.path.basename(pdf), "level": level, "negative": negative, "extra_tilt": round(extra, 1), **p}


def main():
    folder, n = sys.argv[1], int(sys.argv[2])
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    os.makedirs(OUT, exist_ok=True)
    src = []
    for f in sorted(glob.glob(os.path.join(folder, "**", "*.pdf"), recursive=True)):
        a = answers(text_of(f))
        if a:
            src.append((f, a))
    print(f"{len(src)} PDFs have an e-way bill page to take answers from")
    jobs = [(i, *src[i % len(src)], seed) for i in range(n)]
    truth, meta = {}, {}
    with Pool(6) as pool:
        for k, r in enumerate(pool.imap_unordered(one, jobs, chunksize=8), 1):
            if r:
                truth[r[0]], meta[r[0]] = r[1], r[2]
            if k % 250 == 0:
                print(f"  {k}/{n}", flush=True)
    json.dump(truth, open(f"{OUT}/truth.json", "w"), indent=1)
    json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
    size = sum(os.path.getsize(f"{OUT}/{f}") for f in truth) / 1e6
    print(f"{len(truth)} photos ({size:.0f} MB) -> {OUT}; {sum(m['negative'] for m in meta.values())} are non-invoice pages")


if __name__ == "__main__":
    main()
