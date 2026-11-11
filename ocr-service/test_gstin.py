import unittest

from extract import clean_invoice_no, find_gstin, fix_gstin, parse_amounts
from gstin import check_char, is_valid

SAMPLE = "27AAPFU0939F1ZV"  # widely used public sample GSTIN


class GstinTests(unittest.TestCase):
    def test_sample_is_valid(self):
        self.assertTrue(is_valid(SAMPLE))
        self.assertEqual(check_char(SAMPLE[:14]), SAMPLE[14])

    def test_repairs_lookalike_characters_by_position(self):
        # digit positions misread as letters, letter positions misread as digits
        broken = "27AAPFUO939F1ZV"  # 0 -> O in the digit block
        self.assertEqual(fix_gstin(broken), (SAMPLE, "valid"))

    def test_a_wrong_check_character_is_flagged_never_silently_rewritten(self):
        # last character wrong and not a look-alike of the right one: must NOT become "valid"
        self.assertEqual(fix_gstin("27AAPFU0939F1ZX"), ("27AAPFU0939F1ZX", "unverified"))

    def test_a_single_lookalike_swap_in_the_middle_is_repaired(self):
        self.assertEqual(fix_gstin("27AAPFU09B9F1ZV")[1], "unverified")   # no single look-alike swap fixes it
        self.assertEqual(fix_gstin("27AAPFU0939FIZV"), (SAMPLE, "repaired"))  # 1 read as I: plausible, so "verify"

    def test_ignores_fifteen_character_runs_that_are_not_gstins(self):
        self.assertEqual(find_gstin("PODANPURRUDRAPURUSNAGAR"), (None, "unverified"))

    def test_finds_gstin_inside_a_line(self):
        self.assertEqual(find_gstin("GSTIN/UIN : 27AAPFU0939F1ZV"), (SAMPLE, "valid"))


class FieldCleaningTests(unittest.TestCase):
    def test_indian_amounts_with_ocr_damage(self):
        self.assertEqual(parse_amounts("\u20b9 13,78,765.00"), [(1378765.0, True)])
        self.assertEqual(parse_amounts("13,78 765.00")[0][0], 1378765.0)      # space inside
        self.assertEqual(parse_amounts("13.78.765.00")[0][0], 1378765.0)      # commas read as dots
        self.assertFalse(parse_amounts("13,78 765.00")[0][1])                  # ...and flagged as doubtful
        self.assertEqual(parse_amounts("1,591.075 SQM"), [])                  # a quantity is not money

    def test_invoice_number_must_look_like_one(self):
        self.assertEqual(clean_invoice_no("S/26-27/153"), "S/26-27/153")
        self.assertEqual(clean_invoice_no("636"), "636")
        self.assertEqual(clean_invoice_no("S/26-27/285 362324388993 31-Aug-26"), "S/26-27/285")
        self.assertIsNone(clean_invoice_no("Reference No&Date"))
        self.assertIsNone(clean_invoice_no("Buyers Ordr No"))


if __name__ == "__main__":
    unittest.main()
