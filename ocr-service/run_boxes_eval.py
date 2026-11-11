#!/usr/bin/env python3
"""Run extract() on the cached OCR boxes of the 18 test photos and write
ocr-eval/data/preds_new.json (then score with ocr-eval/score.py)."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from extract import extract

root = os.path.join(os.path.dirname(__file__), "..", "ocr-eval", "data")
preds = {}
for f in sorted(glob.glob(f"{root}/boxes/img*.json")):
    name = os.path.basename(f).replace(".json", ".jpeg")
    r = extract(json.load(open(f)))
    preds[name] = {**r["fields"], **r["extra"]}
    if "--show" in sys.argv:
        print(name, json.dumps(r["fields"], ensure_ascii=False), r["extra"], r["warnings"])
json.dump(preds, open(f"{root}/preds_new.json", "w"), indent=2, ensure_ascii=False)
