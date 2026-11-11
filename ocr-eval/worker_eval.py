"""One worker: runs the real service pipeline in-process on a list of images.
  worker_eval.py shard.json out.json   (shard = list of image paths)"""
import json, os, sys, time, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ocr-service"))
import ocr_engine, qr as qr_reader, quality
from extract import extract
from reconcile import reconcile

paths = json.load(open(sys.argv[1])); out = {}
for path in paths:
    name = os.path.basename(path); t0 = time.time()
    try:
        image = ocr_engine.open_image(open(path, "rb").read())
        q = quality.assess(image)
        boxes = ocr_engine.ocr_boxes(image)          # always run OCR here, even if the gate would say "retake"
        result = extract(boxes)
        qr_data = None
        try:
            qr_data = qr_reader.decode_einvoice(image)
        except Exception:
            pass
        raw_fields = dict(result["fields"])
        reconcile(result, qr_data)
        out[name] = {"fields": {**result["fields"], **result["extra"]}, "ocr_only": {**raw_fields, **result["extra"]},
                     "warnings": result["warnings"], "verified": result.get("verified", []), "qr": bool(qr_data),
                     "quality": q, "ms": round((time.time() - t0) * 1000)}
    except Exception as e:
        out[name] = {"fields": {}, "ocr_only": {}, "error": f"{type(e).__name__}: {e}"}
json.dump(out, open(sys.argv[2], "w"))
