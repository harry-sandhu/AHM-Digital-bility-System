import unittest

from extract import extract
from words_amount import total_from_items, words_to_number


def box(text, x, y, w=300, h=24):
    return {"text": text, "conf": 1.0, "pts": [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]}


class Words(unittest.TestCase):
    def test_numbers(self):
        for text, want in [("Thirteen Lakh Sixty Five Thousand Two Hundred Fifty One", 1365251),
                           ("Four Lakh Ninety Thousand Eighty Three", 490083), ("One Lakh Seventy Eight Thousand Five Hundred", 178500),
                           ("Fifty Three Thousand One Hundred", 53100), ("One Crore Two Lakh", 10200000),
                           ("Five Lakh Ten Thousand Three Hundred Fifty", 510350)]:
            self.assertEqual(words_to_number(text), want, text)

    def test_misread_letters_and_not_a_number(self):
        self.assertEqual(words_to_number("Three Lakh Fifly Four Thousnd"), 354000)    # one wrong letter is tolerated
        self.assertIsNone(words_to_number("Thirteen Lakh and Fifty Paise"))
        self.assertIsNone(words_to_number("Banana Split"))


def total_rows(chargeable, tax):
    items = []
    from extract import Page
    boxes = [box("Amount Chargeable (in words)", 40, 1200, 300), box(chargeable, 360, 1200, 600) if chargeable else box("x", 0, 0),
             box("Tax Amount (in words)", 40, 1330, 300), box(tax, 360, 1330, 600)]
    return Page(boxes).items


class TotalFromItems(unittest.TestCase):
    def test_takes_the_chargeable_phrase_not_the_tax_one(self):
        items = total_rows("INR Three Lakh Fifty Four Thousand Only", "INR Fifty Four Thousand Only")
        self.assertEqual(total_from_items(items), 354000.0)

    def test_never_takes_the_tax_phrase_when_the_total_phrase_is_unreadable(self):
        items = total_rows(None, "INR Fifty Four Thousand Only")
        self.assertIsNone(total_from_items(items))


if __name__ == "__main__":
    unittest.main()
