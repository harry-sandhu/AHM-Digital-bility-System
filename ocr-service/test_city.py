import unittest
from extract import city_of


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


if __name__ == "__main__":
    unittest.main()
