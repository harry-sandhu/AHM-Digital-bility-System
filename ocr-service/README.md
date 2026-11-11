# bilty OCR service

Reads photographed Tally-style tax invoices and returns values for the bilty
form (consignor, consignee, GSTINs, invoice no./date, vehicle no., totals ...).
It runs **on the same machine as the backend** and only listens on `127.0.0.1`.

- OCR: [RapidOCR](https://github.com/RapidAI/RapidOCR) (PaddleOCR models on ONNX Runtime), English recognition model.
- Reader (`extract.py`): straightens the page, then reads each field by its
  position next to anchors like "Invoice No.", "Consignee (Ship to)",
  "Motor Vehicle No."; GSTINs are repaired by position and verified with their check character.
- Memory: about 150 MB idle, about 550 MB peak while reading a photo; one photo at a time.
  Roughly 2-3 s per photo on a desktop CPU (measure on your VPS).

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
| `OCR_MODEL_DIR` | `./models` | where `download_models.sh` put the English model |

## Measuring accuracy

`ocr-eval/` holds a scoring harness. Put test photos and a `truth.json` in
`ocr-eval/data/` (git-ignored: they are real customer documents), then:

```sh
python3 ocr-eval/run_service.py && python3 ocr-eval/score.py ocr-eval/data/preds_service.json --verbose
```

Layouts other than Tally-style invoices will need new anchors in `extract.py`;
re-run the score after any change.
