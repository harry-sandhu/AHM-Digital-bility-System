#!/usr/bin/env python3
"""Engine-level comparison independent of any field parser: for each true value in
data/truth.json, is it present in the engine's raw text output?  (An engine that
can't even see the characters can't be rescued by a smarter parser.)

  bench_recall.py <dir-with-img01.txt ... img18.txt>
"""
import json, os, re, sys
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.abspath(__file__))
al = lambda s: re.sub(r"[^A-Z0-9]", "", str(s).upper())
MON = {1:"JAN",2:"FEB",3:"MAR",4:"APR",5:"MAY",6:"JUN",7:"JUL",8:"AUG",9:"SEP",10:"OCT",11:"NOV",12:"DEC"}


def fuzzy_in(hay, needle, thr=0.85):
    if needle in hay: return True
    n = len(needle)
    return any(SequenceMatcher(None, hay[i:i+n], needle).ratio() >= thr for i in range(0, max(1, len(hay)-n+1), 2))


def checks(t):
    y, m, d = t["invoiceDate"].split("-")
    out = {
      "invoice no":  t["invoiceNo"],
      "invoice date": f"{int(d)}{MON[int(m)]}{y[2:]}",
      "seller gstin": t["sellerGstin"],
      "consignee gstin": t.get("consigneeGstin"),
      "vehicle no": t["vehicleNo"],
      "lr no": t["lrNo"],
      "e-way bill": t["ewayBill"],
      "total pcs": None if t.get("totalPcs") is None else str(t["totalPcs"]),
      "total amount": None if t.get("totalAmount") is None else f"{int(t['totalAmount'])}",
      "consignee name": t["consigneeName"],
    }
    return {k: (al(v) if v else None) for k, v in out.items()}


def main(folder):
    truth = json.load(open(f"{HERE}/data/truth.json"))
    tot = {}
    for img, t in truth.items():
        txt = open(os.path.join(folder, img.replace(".jpeg", ".txt")), errors="ignore").read()
        hay = al(txt)
        for k, v in checks(t).items():
            if not v: continue
            ok = fuzzy_in(hay, v) if k == "consignee name" else (v in hay)
            r, n = tot.get(k, (0, 0)); tot[k] = (r + ok, n + 1)
    allr = alln = 0
    for k, (r, n) in tot.items():
        print(f"  {k:<16}{r:>3}/{n:<3} {100*r/n:4.0f}%"); allr += r; alln += n
    print(f"  {'ALL':<16}{allr:>3}/{alln:<3} {100*allr/alln:4.0f}%")


if __name__ == "__main__":
    main(sys.argv[1])
