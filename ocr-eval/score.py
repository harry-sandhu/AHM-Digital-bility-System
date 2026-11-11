#!/usr/bin/env python3
"""Score OCR/extraction output against the correct values.

Usage: score.py preds.json [--truth path/to/truth.json] [--verbose]
(default truth: data/truth.json, the 18 real photos)
"""
import json, os, sys
from scoring import FIELDS, evaluate, false_fills

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    args = sys.argv[1:]
    truth_path = f"{HERE}/data/truth.json"
    if "--truth" in args:
        truth_path = args[args.index("--truth") + 1]
    preds = json.load(open(args[0]))
    truth = json.load(open(truth_path))
    verbose = "--verbose" in args
    res = evaluate(preds, truth)
    print(f"{'field':<20}{'right':>7}{'wrong':>7}{'missing':>9}{'scored':>8}   accuracy")
    tot_r = tot_n = 0
    for name in FIELDS:
        r = sum(1 for v in res.values() if v.get(name) == "right")
        w = sum(1 for v in res.values() if v.get(name) == "wrong")
        m = sum(1 for v in res.values() if v.get(name) == "missing")
        n = r + w + m
        if verbose:
            for img, v in res.items():
                if v.get(name) == "wrong":
                    print(f"   x {img} {name}: expected {truth[img]!r}"[:200])
        tot_r += r; tot_n += n
        print(f"{name:<20}{r:>7}{w:>7}{m:>9}{n:>8}   " + (f"{100 * r / n:5.0f}%" if n else "  n/a"))
    print(f"{'ALL FIELDS':<20}{tot_r:>7}{'':>7}{'':>9}{tot_n:>8}   {100 * tot_r / max(tot_n, 1):5.0f}%")
    ff = false_fills(preds, truth)
    print(f"values filled where the invoice has none: {len(ff)}")


if __name__ == "__main__":
    main()
