import unittest
from extract import _num, city_of, thicknesses


class CityOf(unittest.TestCase):
    def test_towns(self):
        cases = [
            (["PO Danpur, Rudrapur (U.S. Nagar)"], "Rudrapur"),
            (["Po Danpur. Rudrapur U.S. Nagar"], "Rudrapur"),
            (["Po Danpur, Rudrapur U.S. Nagan"], "Rudrapur"),      # light OCR model reads the last "r" as "n"
            (["Lalpur, Kichha Road, Rudrapur"], "Rudrapur"),
            (["Industrial Area, Bhiwadi", "Distt. Alwar, Rajasthan-301707"], "Bhiwadi"),
            (["Mohan Nagar", "Ghaziabad-201007"], "Ghaziabad"),
            (["Village Jorian", "Yamuna Nagar", "Haryana"], "Yamuna Nagar"),
            (["Mundka Delhi, West Delhi"], "Delhi"),
            (["BIBI TOLA, BAIRIYA, Ballia, Uttar Pradesh, 277216"], "Ballia"),
            (["Yamuna Nagar", "Hanyana"], "Yamuna Nagar"),   # misread state is still skipped
            (["VPO.HAMBRAN, DISTT:LUDHIANA, PUNJAB", "Punjab - 141110, India"], "Hambran"),
            (["VILL:NOORPURA TEH:BHAWANIGARH,", "DISTT:SANGRUR, PUNJAB, PUNJAB"], "Bhawanigarh"),
            (["TEH. BAHADURGARH,", "JHAJJAR HARYANA, HARYANA", "Haryana - 124501, India"], "Jhajjar"),
            (["VILL:BHISHARAT NAGAR, TEH:BILASPUR,", "RAMPUR, UP, UP", "Uttar Pradesh - 244921, India"], "Rampur"),
        ]
        for lines, want in cases:
            self.assertEqual(city_of(lines), want, lines)

    def test_nothing_sensible(self):
        self.assertIsNone(city_of(["Naini Plywood Pvt. Ltd"]))
        self.assertIsNone(city_of(["Rajasthan-311001"]))
        self.assertIsNone(city_of([]))


class DamagedOcr(unittest.TestCase):
    def test_glued_origin(self):
        for text, want in [("U.S.Nagaruttrakhand", None), ("Kashipuru.S.Nagar", "Kashipur"), ("S.Nagar.Uttrakhand", None),
                           ("KASHIPUR U.S.Nagar", "Kashipur")]:
            self.assertEqual(city_of([text]), want, text)
        self.assertEqual(city_of(["MAHUKHERA, KASHIPUR,", "U.S.Nagaruttrakhand"]), "Kashipur")

    def test_amounts_with_lost_separators(self):
        from extract import parse_amounts
        self.assertEqual(parse_amounts("<3,54000.00")[0][0], 354000.0)
        self.assertEqual(parse_amounts("3,54000.00")[0][0], 354000.0)
        self.assertEqual(parse_amounts("3,00,00000")[0][0], 300000.0)
        self.assertEqual(parse_amounts("₹3,54,000.00"), [(354000.0, True)])
        self.assertEqual(parse_amounts("10,000.000KG"), [])        # a quantity is not money
        self.assertEqual(parse_amounts("44123190"), [])            # nor is an HSN code


class Thickness(unittest.TestCase):
    def test_glued_and_separate_row_numbers(self):
        self.assertEqual(thicknesses(["125mm Plywood 1.840x0.920", "225mm Plywood 2.140x0.710", "330mm Plywood"]), [25, 30])
        self.assertEqual(thicknesses(["1 19mm Plywood", "212mm Plywood", "39mm Plywood", "4 6mm Plywood"]), [6, 9, 12, 19])
        self.assertEqual(thicknesses(["6 MM Comm Plywood", "2 6 MM Comm", "418 MM Comm", "5 8 MM Comm", "6 12 MM Comm"]), [6, 8, 12, 18])

    def test_none(self):
        self.assertEqual(thicknesses(["Jai Mata Di Plywood"]), [])


class Quantity(unittest.TestCase):
    def test_lost_decimal_point(self):
        self.assertEqual(_num("7,00000"), "7000")      # OCR read "7,000.00" without the point
        self.assertEqual(_num("7,000.00"), "7000")
        self.assertEqual(_num("1,234"), "1234")
        self.assertEqual(_num("12.5"), "12.5")


if __name__ == "__main__":
    unittest.main()
