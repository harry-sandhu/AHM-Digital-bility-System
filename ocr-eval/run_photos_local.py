#!/usr/bin/env python3
"""OCR the 18 real photos in-process (no server) with the current OCR_* settings
and write data/preds_local.json for score.py.

  OCR_TEXT_SCORE=0.3 ../ocr-service/venv/bin/python run_photos_local.py && python3 score.py data/preds_local.json
"""
import glob, json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ocr-service"))
import ocr_engine, reader  # noqa: E402

preds, t0 = {}, time.time()
for path in sorted(glob.glob(f"{HERE}/data/img*.jpeg")):
    _, r = reader.read(ocr_engine.open_image(open(path, "rb").read()))
    preds[os.path.basename(path)] = {**r["fields"], **r["extra"]}
json.dump(preds, open(f"{HERE}/data/preds_local.json", "w"), indent=2, ensure_ascii=False)
print(f"{len(preds)} photos in {time.time() - t0:.0f}s -> data/preds_local.json")
