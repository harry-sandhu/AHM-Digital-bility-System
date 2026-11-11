FROM python:3.12-slim-bookworm

# libgl1 / libglib2.0-0: OpenCV (a RapidOCR dependency) needs them on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends curl libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MALLOC_ARENA_MAX=2 \
    OCR_HOST=0.0.0.0

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY download_models.sh .
RUN sh download_models.sh

COPY *.py ./

# Reachable only on the compose network; never publish this port to the internet.
EXPOSE 8787
USER 10001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=3).status==200 else 1)"
CMD ["python", "server.py"]
