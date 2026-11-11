#!/usr/bin/env python3
"""Tiny local OCR service for the bilty backend.

POST /extract   body = raw image bytes (jpeg/png/webp)
  -> {"fields": {...form values...}, "extra": {...}, "warnings": [...], "rawText": "..."}
GET  /health    -> {"ok": true}

Standard library HTTP server on purpose: no web-framework memory overhead on a
small VPS. Listens on 127.0.0.1 only (the backend runs on the same machine);
set OCR_KEY to also require a shared secret in the X-OCR-Key header.
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(__file__))
import ocr_engine  # noqa: E402
import pdf_reader  # noqa: E402
import qr as qr_reader  # noqa: E402
import quality  # noqa: E402
from extract import extract  # noqa: E402
from reconcile import reconcile  # noqa: E402

HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8787"))
KEY = os.environ.get("OCR_KEY", "")
MAX_BYTES = 15 * 1024 * 1024


def raw_text(boxes):
    rows = sorted(boxes, key=lambda b: (round(b["pts"][0][1] / 14), b["pts"][0][0]))
    return "\n".join(b["text"] for b in rows)


class Handler(BaseHTTPRequestHandler):
    server_version = "bilty-ocr"

    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/extract":
            return self._send(404, {"error": "not found"})
        if KEY and self.headers.get("X-OCR-Key") != KEY:
            return self._send(401, {"error": "bad key"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return self._send(400, {"error": "empty body"})
        if length > MAX_BYTES:
            return self._send(413, {"error": "image too large"})
        data = self.rfile.read(length)
        t0 = time.time()
        if data[:5] == b"%PDF-" or "pdf" in (self.headers.get("Content-Type") or "").lower():
            try:
                result = pdf_reader.read_pdf(data)
            except Exception as exc:
                return self._send(400, {"error": f"could not read the PDF ({type(exc).__name__})"})
            result.update(rawText="", ms=round((time.time() - t0) * 1000))
            return self._send(200, result)
        try:
            image = ocr_engine.open_image(data)
        except Exception:  # undecodable image
            return self._send(400, {"error": "could not read the image"})

        # Too blurry / dark / small to read reliably: ask for a retake instead of guessing.
        q = quality.assess(image)
        if q["reasons"]:
            return self._send(200, {"fields": {}, "extra": {}, "warnings": [], "verified": [],
                                    "retake": q["reasons"], "quality": q, "rawText": "",
                                    "ms": round((time.time() - t0) * 1000)})

        try:
            boxes = ocr_engine.ocr_boxes(image)
        except Exception:
            return self._send(400, {"error": "could not read the image"})
        try:
            result = extract(boxes)
        except Exception as exc:  # a parser bug must not lose the OCR text
            result = {"fields": {}, "extra": {}, "warnings": [f"reader error: {type(exc).__name__}"]}
        try:
            reconcile(result, qr_reader.decode_einvoice(image))
        except Exception:  # the QR check is a bonus; never fail the request over it
            result.setdefault("verified", [])
        result["quality"] = q
        result["rawText"] = raw_text(boxes)
        result["ms"] = round((time.time() - t0) * 1000)
        self._send(200, result)

    def log_message(self, fmt, *args):  # no request logging: payloads are customer documents
        pass


if __name__ == "__main__":
    ocr_engine._get_engine()  # load models once, up front
    print(f"bilty-ocr listening on {HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
