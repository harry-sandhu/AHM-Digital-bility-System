#!/usr/bin/env python3
"""Speed vs accuracy of OCR settings, pinned to ONE cpu core (like a 1 vCPU server).

  OCR_DET_LIMIT=960 OCR_DET_TYPE=max OCR_ANGLE_CLS=0 taskset -c 0 python bench_speed.py [n_synth]

Runs the real pipeline on the 18 real photos + n_synth generated phone photos,
prints average/slowest seconds per photo and the field accuracy.
"""
import glob, json, os, resource, statistics, sys, time, warnings
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, f"{HERE}/../ocr-service"); sys.path.insert(0, HERE)
import ocr_engine, qr, quality
from extract import extract
from reconcile import reconcile
from scoring import evaluate

n_synth = int(sys.argv[1]) if len(sys.argv) > 1 else 24
sets = [(f"{HERE}/data", sorted(glob.glob(f"{HERE}/data/img*.jpeg")), f"{HERE}/data/truth.json"),
        (f"{HERE}/data/synthphoto", sorted(glob.glob(f"{HERE}/data/synthphoto/*.jpg"))[:n_synth], f"{HERE}/data/synthphoto/truth.json")]
ocr_engine._get_engine()
out = {}
for _, files, truth_path in sets:
    truth = json.load(open(truth_path)); preds, times = {}, []
    for f in files:
        t0 = time.time()
        img = ocr_engine.open_image(open(f, "rb").read())
        if quality.assess(img)["reasons"]:
            continue
        r = extract(ocr_engine.ocr_boxes(img)); reconcile(r, qr.decode_einvoice(img))
        preds[os.path.basename(f)] = {**r["fields"], **r["extra"]}
        times.append(time.time() - t0)
    ev = evaluate(preds, {k: v for k, v in truth.items() if k in preds})
    n = sum(len(v) for v in ev.values()); right = sum(1 for v in ev.values() for x in v.values() if x == "right")
    wrong = sum(1 for v in ev.values() for x in v.values() if x == "wrong")
    name = os.path.basename(os.path.dirname(truth_path))
    out["real" if name == "data" else name] = (times, right, wrong, n)
    if os.environ.get("VERBOSE"):
        for img, e in ev.items():
            for fld, v in e.items():
                if v == "wrong":
                    print(f"   wrong: {img} {fld}", flush=True)
allt = [t for v in out.values() for t in v[0]]
acc = " | ".join(f"{k}: {100*v[1]/max(v[3],1):.1f}% right, {100*v[2]/max(v[3],1):.1f}% wrong, {statistics.mean(v[0]):.2f}s" for k, v in out.items())
cfg = {k: os.environ.get(k) for k in ("OCR_DET_LIMIT", "OCR_DET_TYPE", "OCR_ANGLE_CLS", "OCR_REC_BATCH", "OCR_MAX_SIDE")}
print(f"avg {statistics.mean(allt):.2f}s  median {statistics.median(allt):.2f}s  slowest {max(allt):.2f}s  ({len(allt)} photos) | {acc} | peak {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024:.0f} MB | {cfg}")
