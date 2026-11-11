#!/usr/bin/env python3
"""Send every test image to the OCR service (POST /extract) and save the result
for score.py.   OCR_URL=http://127.0.0.1:8787 OCR_KEY=... python3 run_service.py"""
import glob, json, os, time, urllib.request

URL = os.environ.get("OCR_URL", "http://127.0.0.1:8787").rstrip("/")
KEY = os.environ.get("OCR_KEY", "")
HERE = os.path.dirname(__file__)
preds, times = {}, []
for path in sorted(glob.glob(f"{HERE}/data/img*.jpeg")):
    req = urllib.request.Request(f"{URL}/extract", data=open(path, "rb").read(), method="POST",
                                 headers={"X-OCR-Key": KEY, "Content-Type": "image/jpeg"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=180) as r:
        res = json.load(r)
    times.append(time.time() - t0)
    preds[os.path.basename(path)] = {**res["fields"], **res["extra"]}
json.dump(preds, open(f"{HERE}/data/preds_service.json", "w"), indent=2, ensure_ascii=False)
print(f"{len(times)} images, avg {sum(times)/len(times):.1f}s, slowest {max(times):.1f}s")
