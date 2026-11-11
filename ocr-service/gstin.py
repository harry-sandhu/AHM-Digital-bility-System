"""GSTIN helpers: format check and the check-character (mod-36) validation."""
import re

_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_FORMAT = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


def check_char(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        product = _CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return _CHARS[(36 - total % 36) % 36]


def is_valid(gstin: str) -> bool:
    g = (gstin or "").strip().upper()
    return bool(_FORMAT.match(g)) and check_char(g[:14]) == g[14]
