"""Reads the invoice total out of "Amount Chargeable (in words): INR Thirteen Lakh Sixty Five Thousand Two Hundred
Fifty One Only". The digits of a total are easy for OCR to damage; the words are ordinary English and much safer,
so they are an independent check (and a repair) for the number."""
import difflib
import re

_UNITS = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
          "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
          "seventeen": 17, "eighteen": 18, "nineteen": 19}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fourty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
_SCALE = {"hundred": 100, "thousand": 1000, "lakh": 100000, "lakhs": 100000, "lac": 100000, "crore": 10000000, "crores": 10000000}
_WORDS = list(_UNITS) + list(_TENS) + list(_SCALE)


def _word(tok):
    """A word from the number vocabulary, allowing one or two misread letters ("Thousnd", "Fifly")."""
    tok = tok.lower()
    if tok in _UNITS or tok in _TENS or tok in _SCALE:
        return tok
    m = difflib.get_close_matches(tok, _WORDS, n=1, cutoff=0.8)
    return m[0] if m else None


def words_to_number(text):
    """"Thirteen Lakh Sixty Five Thousand Two Hundred Fifty One" -> 1365251, or None if it is not a clean number."""
    toks = re.findall(r"[A-Za-z]+", text)
    total = current = 0
    seen = False
    for t in toks:
        w = _word(t)
        if w is None:
            if t.lower() in ("and", "rupees", "rupee", "only", "inr", "rs"):
                continue
            return None
        seen = True
        if w in _UNITS:
            current += _UNITS[w]
        elif w in _TENS:
            current += _TENS[w]
        elif w == "hundred":
            current = max(current, 1) * 100
        else:
            total += max(current, 1) * _SCALE[w]
            current = 0
    return total + current if seen else None


_LINE = re.compile(r"(?i)\bINR\b[:\s]*(.+?)\bonly\b")


def total_in_words(lines):
    """First "INR ... Only" phrase in `lines` that reads as a number of at least 3 digits, as a float (paise ignored)."""
    for ln in lines:
        m = _LINE.search(ln)
        if not m:
            continue
        v = words_to_number(m.group(1))
        if v and v >= 100:
            return float(v)
    return None


def total_from_items(items):
    """The invoice total from the "Amount Chargeable (in words)" phrase, found by position in the OCR items
    (objects with .text .x0 .x1 .cy .h, deskewed). Only a phrase that has an "Amount Chargeable" label above or
    beside it, and no "Tax" label beside it, counts: the tax amount in words sits just below the invoice total
    and would otherwise be taken for it. -> float or None."""
    labels = [i for i in items if re.search(r"(?i)chargeable", i.text)]
    if not labels:
        return None
    for it in sorted(items, key=lambda i: (i.cy, i.x0)):
        m = _LINE.search(it.text)
        if not m or re.search(r"(?i)\btax\b", it.text[: m.start() + 3]):
            continue
        h = max(it.h, 10)
        if any(re.search(r"(?i)\btax\b", o.text) and abs(o.cy - it.cy) < 0.8 * h and o.x1 <= it.x0 + 5 for o in items):
            continue                                                    # "Tax Amount (in words)" to its left
        if not any(it.cy - 3.5 * h <= lb.cy <= it.cy + 0.8 * h for lb in labels):
            continue                                                    # no "Amount Chargeable" label near it
        v = words_to_number(m.group(1))
        if v and v >= 100:
            return float(v)
    return None
