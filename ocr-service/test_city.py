import unittest
from extract import city_of, thicknesses


class CityOf(unittest.TestCase):
    def test_towns(self):
        cases = [
            (["PO Danpur, Rudrapur (U.S. Nagar)"], "Rudrapur"),
            (["Po Danpur. Rudrapur U.S. Nagar"], "Rudrapur"),
            (["Lalpur, Kichha Road, Rudrapur"], "Rudrapur"),
            (["Industrial Area, Bhiwadi", "Distt. Alwar, Rajasthan-301707"], "Bhiwadi"),
            (["Mohan Nagar", "Ghaziabad-201007"], "Ghaziabad"),
            (["Village Jorian", "Yamuna Nagar", "Haryana"], "Yamuna Nagar"),
            (["Mundka Delhi, West Delhi"], "Delhi"),
            (["BIBI TOLA, BAIRIYA, Ballia, Uttar Pradesh, 277216"], "Ballia"),
            (["Yamuna Nagar", "Hanyana"], "Yamuna Nagar"),   # misread state is still skipped
        ]
        for lines, want in cases:
            self.assertEqual(city_of(lines), want, lines)

    def test_nothing_sensible(self):
        self.assertIsNone(city_of(["Naini Plywood Pvt. Ltd"]))
        self.assertIsNone(city_of(["Rajasthan-311001"]))
        self.assertIsNone(city_of([]))


class Thickness(unittest.TestCase):
    def test_glued_and_separate_row_numbers(self):
        self.assertEqual(thicknesses(["125mm Plywood 1.840x0.920", "225mm Plywood 2.140x0.710", "330mm Plywood"]), [25, 30])
        self.assertEqual(thicknesses(["1 19mm Plywood", "212mm Plywood", "39mm Plywood", "4 6mm Plywood"]), [6, 9, 12, 19])
        self.assertEqual(thicknesses(["6 MM Comm Plywood", "2 6 MM Comm", "418 MM Comm", "5 8 MM Comm", "6 12 MM Comm"]), [6, 8, 12, 18])

    def test_none(self):
        self.assertEqual(thicknesses(["Jai Mata Di Plywood"]), [])


if __name__ == "__main__":
    unittest.main()
