#!/usr/bin/env python3
"""Breakdowns of a dataset run.   analyze.py <set>    (set = aug | synth)"""
import json, os, sys
from collections import defaultdict
from scoring import FIELDS, evaluate, false_fills

HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1]
d = f"{HERE}/data/{name}"
truth = json.load(open(f"{d}/truth.json")); meta = json.load(open(f"{d}/meta.json")); res = json.load(open(f"{d}/results.json"))
final = {k: v.get("fields", {}) for k, v in res.items()}
ocr_only = {k: v.get("ocr_only", {}) for k, v in res.items()}
ev, ev_ocr = evaluate(final, truth), evaluate(ocr_only, truth)


def tally(e, keys=None):
    r = w = m = 0
    for img in (keys or e):
        for f, v in e.get(img, {}).items():
            r += v == "right"; w += v == "wrong"; m += v == "missing"
    n = r + w + m
    return r, w, m, n


def line(label, keys):
    r, w, m, n = tally(ev, keys)
    return f"  {label:<34} {len(list(keys)):>4} imgs  right {100*r/max(n,1):5.1f}%  wrong {100*w/max(n,1):4.1f}%  blank {100*m/max(n,1):5.1f}%"


imgs = list(truth)
r, w, m, n = tally(ev); r2, w2, m2, n2 = tally(ev_ocr)
print(f"=== {name}: {len(imgs)} images, {n} scored fields ===")
print(f"  OCR + QR check : right {100*r/n:5.1f}%   wrong {100*w/n:4.1f}%   blank {100*m/n:5.1f}%")
print(f"  OCR only       : right {100*r2/n2:5.1f}%   wrong {100*w2/n2:4.1f}%   blank {100*m2/n2:5.1f}%")
print(f"  false fills (value where invoice has none): {len(false_fills(final, truth))}")
print(f"  QR decoded on {sum(1 for v in res.values() if v.get('qr'))}/{len(res)} images; errors: {sum(1 for v in res.values() if 'error' in v)}")
ms = sorted(v.get('ms', 0) for v in res.values()); print(f"  time per image (6 in parallel, 2 cores each): median {ms[len(ms)//2]/1000:.1f}s, p95 {ms[int(len(ms)*.95)]/1000:.1f}s")

# wrong values: were they flagged by a warning?
silent = flagged = 0
for img, e in ev.items():
    wr = [f for f, v in e.items() if v == "wrong"]
    if wr:
        if res[img].get("warnings"): flagged += len(wr)
        else: silent += len(wr)
print(f"  wrong values: {silent} with no warning, {flagged} in photos that also carried a warning")

print("\n-- by overall photo condition")
for lv in ("light", "normal", "harsh"):
    print(line(f"effects level: {lv}", [i for i in imgs if meta[i]["level"] == lv]))
sharp = {i: res[i].get("quality", {}).get("sharpness", 0) for i in imgs}
buckets = [(0, 40), (40, 80), (80, 150), (150, 300), (300, 700), (700, 1e9)]
print("\n-- by sharpness (variance of Laplacian; higher = sharper)")
for lo, hi in buckets:
    ks = [i for i in imgs if lo <= sharp[i] < hi]
    if ks: print(line(f"sharpness {lo:>4}-{'up' if hi>1e8 else int(hi):<5}", ks))
print("\n-- by resolution scale")
for lo, hi in ((0, .6), (.6, .8), (.8, .99), (.99, 2)):
    ks = [i for i in imgs if lo <= meta[i].get("scale", 1) < hi]
    if ks: print(line(f"scale {lo:.2f}-{hi:.2f}", ks))
print("\n-- by rotation")
for lo, hi in ((0, 2), (2, 5), (5, 9)):
    ks = [i for i in imgs if lo <= abs(meta[i].get("rotate", 0)) < hi]
    if ks: print(line(f"|rotate| {lo}-{hi} deg", ks))
print("\n-- by darkness (contrast factor)")
for lo, hi in ((0, .8), (.8, .95), (.95, 2)):
    ks = [i for i in imgs if lo <= meta[i].get("contrast", 1) < hi]
    if ks: print(line(f"contrast {lo}-{hi}", ks))

if name.startswith("synth"):
    print("\n-- layout variations (generated invoices)")
    print(line("all standard wording", [i for i in imgs if not meta[i]["wording"]]))
    print(line("some unfamiliar label wording", [i for i in imgs if meta[i]["wording"]]))
    for lab in ("ship", "bill", "vehicle", "lr", "desc", "dest", "invoice"):
        ks = [i for i in imgs if lab in meta[i]["wording"]]
        if ks:
            examples = sorted({meta[i]["wording"][lab] for i in ks})
            print(line(f"unfamiliar '{lab}': {', '.join(examples)}"[:60], ks))
    print(line("rows in a different order", [i for i in imgs if meta[i]["rows_shuffled"]]))
    print(line("serif font", [i for i in imgs if meta[i]["font"] == "serif"]))
    print(line("ALL CAPS consignee", [i for i in imgs if meta[i]["caps"]]))
    print(line("page 1 of 2 (no totals)", [i for i in imgs if not meta[i]["complete"]]))
    print(line("has QR on the page", [i for i in imgs if meta[i]["qr"]]))
    print(line("no QR", [i for i in imgs if not meta[i]["qr"]]))

print("\n-- per field (all images)")
for f in FIELDS:
    r_ = sum(1 for e in ev.values() if e.get(f) == "right"); w_ = sum(1 for e in ev.values() if e.get(f) == "wrong"); m_ = sum(1 for e in ev.values() if e.get(f) == "missing")
    n_ = r_ + w_ + m_
    if n_: print(f"  {f:<20} right {100*r_/n_:5.1f}%  wrong {100*w_/n_:4.1f}%  blank {100*m_/n_:5.1f}%   (n={n_})")

print("\n-- where would a 'please retake' gate help?  (threshold on sharpness)")
for th in (40, 60, 80, 100, 150, 200):
    keep = [i for i in imgs if sharp[i] >= th]; drop = [i for i in imgs if sharp[i] < th]
    rk, wk, mk, nk = tally(ev, keep); rd, wd, md, nd = tally(ev, drop)
    print(f"  threshold {th:>3}: asks retake on {100*len(drop)/len(imgs):4.1f}% of photos | kept photos: right {100*rk/max(nk,1):5.1f}% wrong {100*wk/max(nk,1):4.1f}% | retaken photos were: right {100*rd/max(nd,1):5.1f}% wrong {100*wd/max(nd,1):4.1f}%")
