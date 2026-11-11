#!/usr/bin/env python3
"""Runs the OCR service pipeline over every image in data/<set>/ using several
worker processes (each pinned to its own CPU cores).

  run_dataset.py <set> [workers]       e.g.  run_dataset.py synth 6
writes data/<set>/results.json
"""
import glob, json, os, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.environ.get("PYTHON", sys.executable)
name = sys.argv[1]; workers = int(sys.argv[2]) if len(sys.argv) > 2 else 6
d = f"{HERE}/data/{name}"
paths = sorted(glob.glob(f"{d}/*.jpg") + glob.glob(f"{d}/*.jpeg"))
shards = [paths[i::workers] for i in range(workers)]
tmp = tempfile.mkdtemp(); procs = []
t0 = time.time()
for i, sh in enumerate(shards):
    sj, oj = f"{tmp}/s{i}.json", f"{tmp}/o{i}.json"
    json.dump(sh, open(sj, "w"))
    cores = f"{2*i},{2*i+1}"
    procs.append((oj, subprocess.Popen(["taskset", "-c", cores, PY, f"{HERE}/worker_eval.py", sj, oj],
                                       env={**os.environ, "MALLOC_ARENA_MAX": "2"})))
results = {}
for oj, p in procs:
    p.wait()
    if os.path.exists(oj): results.update(json.load(open(oj)))
json.dump(results, open(f"{d}/results.json", "w"))
print(f"{len(results)}/{len(paths)} images in {time.time()-t0:.0f}s -> {d}/results.json")
