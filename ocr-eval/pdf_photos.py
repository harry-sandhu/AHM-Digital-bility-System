#!/usr/bin/env python3
"""Turn digital PDF invoices into phone-style photos and check what the photo
reader (the OCR path) gets right, using each PDF's e-way bill page as the answer.

  python3 pdf_photos.py <folder with the PDFs> [level ...]     levels: mild light normal harsh

Uses the same model settings as the server (OCR_MODEL_DIR / OCR_REC_HEIGHT).
Images are made in memory only; nothing from the PDFs is written to the repo.
"""
import glob, io, os, random, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ocr-service"))
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from photo_effects import photo_effects  # noqa: E402
import ocr_engine, quality  # noqa: E402
from extract import extract  # noqa: E402
from pdf_check import text_of, truth_from, checks  # noqa: E402


def page_one(pdf):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["pdftoppm", "-r", os.environ.get("PDF_DPI", "220"), "-f", "1", "-l", "1", "-png", pdf, f"{d}/p"], check=True, capture_output=True)
        return Image.open(sorted(glob.glob(f"{d}/p*.png"))[0]).convert("RGB")


def main():
    folder = sys.argv[1]
    levels = sys.argv[2:] or ["mild", "normal"]
    rng = random.Random(7)
    stats, retake, n, t0 = {}, 0, 0, time.time()
    for f in sorted(glob.glob(os.path.join(folder, "**", "*.pdf"), recursive=True)):
        t = truth_from(text_of(f))
        if "invoiceNo" not in t:
            continue
        page = page_one(f)
        for level in levels:
            _, _, raw = photo_effects(page, rng, level)
            image = ocr_engine.open_image(raw)
            n += 1
            if quality.assess(image)["reasons"]:
                retake += 1
                continue
            pred = extract(ocr_engine.ocr_boxes(image))["fields"]
            for k, ok in checks(pred, t).items():
                if ok is None:
                    continue
                stats.setdefault(level, {}).setdefault(k, [0, 0])[0 if ok else 1] += 1
                if not ok:
                    print(f"  wrong {level} {os.path.basename(f)} {k}")
    for level, ks in stats.items():
        r = sum(v[0] for v in ks.values()); w = sum(v[1] for v in ks.values())
        print(f"\n[{level}] {100 * r / max(r + w, 1):.1f}% of {r + w} checks")
        for k, (a, b) in ks.items():
            print(f"   {k:<18}{a:>4} right {b:>3} wrong")
    print(f"\n{n} photos, {retake} rejected as unreadable, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
