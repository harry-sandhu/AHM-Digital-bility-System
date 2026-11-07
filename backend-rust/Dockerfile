# Multi-stage build. OCR system libraries are installed now (Module 0) even
# though unused until Module 5's bill-scan feature lands, so any Render/Docker
# build problem with them surfaces immediately rather than after five modules
# of business logic are already written.
FROM rust:1.89-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    tesseract-ocr \
    libtesseract-dev \
    libleptonica-dev \
    tesseract-ocr-eng \
    clang \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Bundles the same pinned pdfium release verified locally this session
# (chromium/8125, matching the pdfium-render crate's pdfium_8125 binding
# version) rather than relying on a system package — Debian doesn't ship
# one, so without this step PDF bill-scanning silently has nothing to bind
# to at runtime (image bill-scanning is unaffected either way, since that
# path only needs Tesseract/Leptonica, not pdfium).
RUN curl -sL -o /tmp/pdfium.tgz \
    https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F8125/pdfium-linux-x64.tgz \
    && mkdir -p /opt/pdfium \
    && tar -xzf /tmp/pdfium.tgz -C /opt/pdfium lib/ \
    && rm /tmp/pdfium.tgz

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim

# Runtime-only shared-lib package names for tesseract/leptonica have shifted
# across Debian point releases (e.g. libtesseract5/libleptonica6 disappearing
# or getting renamed). Installing the same -dev packages the builder stage
# already uses pulls in their runtime .so dependencies under whatever name
# is actually current, at the cost of some unused headers/static libs — more
# image weight, but it can't go stale the way a guessed exact package name
# can.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tesseract-ocr \
    libtesseract-dev \
    libleptonica-dev \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --no-create-home --shell /usr/sbin/nologin appuser

WORKDIR /app
COPY --from=builder /app/target/release/backend-rust ./backend-rust
COPY --from=builder /opt/pdfium/lib/libpdfium.so ./lib/libpdfium.so

ENV PDFIUM_LIB_PATH=/app/lib/libpdfium.so

# Never run an internet-facing process that parses untrusted uploads
# (images/PDFs via Tesseract/Leptonica/pdfium) as root — a parser
# vulnerability would otherwise hand an attacker root in the container.
USER appuser

EXPOSE 5000
CMD ["./backend-rust"]
