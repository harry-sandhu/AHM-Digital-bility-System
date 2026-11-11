#!/usr/bin/env python3
"""Send every image in data/ to a running backend's /api/bilty/extract-bill and
save what the CURRENT OCR pipeline returns, for score.py.

  TOKEN=<jwt> API=http://localhost:5055 python3 run_current.py
"""
import glob, json, os, sys, time, urllib.request, uuid

API = os.environ.get("API", "http://localhost:5055").rstrip("/")
TOKEN = os.environ.get("TOKEN") or sys.exit("set TOKEN to a logged-in user's JWT")
HERE = os.path.dirname(__file__)


def post_image(path):
    boundary = uuid.uuid4().hex
    data = open(path, "rb").read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"bill\"; filename=\"{os.path.basename(path)}\"\r\n"
            f"Content-Type: image/jpeg\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{API}/api/bilty/extract-bill", data=body, method="POST", headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


preds, raw = {}, {}
for path in sorted(glob.glob(f"{HERE}/data/img*.jpeg")):
    name = os.path.basename(path)
    t0 = time.time()
    try:
        res = post_image(path)
        preds[name] = res.get("extractedFields", {})
        raw[name] = res.get("rawText", "")
        print(f"{name}: {len(preds[name])} fields in {time.time() - t0:.1f}s")
    except Exception as e:
        preds[name] = {}
        print(f"{name}: FAILED {e}")
json.dump(preds, open(f"{HERE}/data/preds_current.json", "w"), indent=2, ensure_ascii=False)
json.dump(raw, open(f"{HERE}/data/raw_text_current.json", "w"), indent=2, ensure_ascii=False)
