# bilty OCR service

Reads photographed Tally-style tax invoices and returns values for the bilty
form (consignor, consignee, GSTINs, invoice no./date, vehicle no., totals ...).
It runs **on the same machine as the backend** and only listens on `127.0.0.1`.

- OCR: [RapidOCR](https://github.com/RapidAI/RapidOCR) (PaddleOCR models on ONNX Runtime), English recognition model.
- Reader (`extract.py`): straightens the page, then reads each field by its
  position next to anchors like "Invoice No.", "Consignee (Ship to)",
  "Motor Vehicle No."; GSTINs are repaired by position and verified with their check character.
- Memory: about 150 MB idle, about 550 MB peak while reading a photo; one photo at a time.
  About 2 s per photo on one core of a desktop CPU (measure on your VPS: server cores can be slower).

## What it reads
- **Photos** (JPEG/PNG/WebP): OCR, then the position-based reader.
- **PDFs**: digital PDFs (Tally "Save as PDF") carry their own text with exact positions, so they are read
  directly with no OCR (about 1.5 s, little memory). Scanned PDFs are rendered and OCR'd like a photo.
  Needs `poppler-utils` (already in the Dockerfile; on a bare server: `apt install poppler-utils`).
- Invoices with **no "Consignee (Ship to)" block** use the Buyer (Bill to) as the consignee and say so in a warning.
  Totals in **kg** (or other units) fill the weight; "(280 BAGS X 25 KGS)" fills packages and packing.

## Set up on the VPS

```sh
cd ocr-service
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./download_models.sh            # English recognition model (~9 MB)
OCR_KEY=change-me ./venv/bin/python server.py   # try it: GET http://127.0.0.1:8787/health
```

Run it as a service (systemd, `/etc/systemd/system/bilty-ocr.service`):

```ini
[Unit]
Description=bilty OCR service
After=network.target

[Service]
WorkingDirectory=/opt/bilty/ocr-service
ExecStart=/opt/bilty/ocr-service/venv/bin/python server.py
Environment=OCR_KEY=change-me
Environment=MALLOC_ARENA_MAX=2
Restart=always
User=bilty
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
```

Then give the backend these environment variables (same key):

```
OCR_SERVICE_URL=http://127.0.0.1:8787
OCR_SERVICE_KEY=change-me
```

If the service is missing or down, the backend falls back to its built-in
Tesseract scan automatically (much less accurate on photos).

## Settings

| env | default | meaning |
|---|---|---|
| `OCR_PORT` / `OCR_HOST` | `8787` / `127.0.0.1` | where it listens |
| `OCR_KEY` | (none) | if set, requests must send `X-OCR-Key` |
| `OCR_MAX_SIDE` | `1600` | photos are shrunk to this long side before OCR (less memory) |
| `OCR_DET_LIMIT` / `OCR_DET_TYPE` | `1100` / `max` | text detection works at most this many pixels on the long side. Smaller = faster but loses accuracy (960 starts losing fields, 800 loses many) |
| `OCR_ANGLE_CLS` | `0` | `1` re-enables the per-line 180-degree check (about 0.3 s slower, no accuracy gain on upright photos) |
| `OCR_QR_BUDGET` | `0.7` | seconds to spend looking for the e-invoice QR code |
| `OCR_THREADS` | auto | ONNX Runtime threads. Auto = its own default, except under a hard CPU quota (Docker `cpus:`), where it is capped to the quota. A quota with the default threads made one scan take 40 s+, so prefer `cpu_shares` (priority) to `cpus` (quota) in compose |
| `OCR_MODEL_DIR` | `./models` | where `download_models.sh` put the English model |

## Measuring accuracy

`ocr-eval/` holds a scoring harness. Put test photos and a `truth.json` in
`ocr-eval/data/` (git-ignored: they are real customer documents), then:

```sh
python3 ocr-eval/run_service.py && python3 ocr-eval/score.py ocr-eval/data/preds_service.json --verbose
```

Layouts other than Tally-style invoices will need new anchors in `extract.py`;
re-run the score after any change.
