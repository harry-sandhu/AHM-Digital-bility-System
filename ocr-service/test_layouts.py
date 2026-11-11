"""Layout handling on synthetic boxes (no customer data)."""
import unittest

from extract import extract


def box(text, x, y, w=300, h=24):
    return {"text": text, "conf": 1.0, "pts": [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]}


def bill_to_only_invoice(total_unit="KG"):
    """A Tally-style invoice with NO "Consignee (Ship to)" block: the Buyer (Bill to) is the consignee."""
    qty = "7,000.000 KG" if total_unit == "KG" else "654.00 PCS1,591.075 SQM"
    return [
        box("Tax Invoice", 500, 20, 200),
        box("Invoice No.", 700, 70, 150), box("214", 700, 100, 80), box("372329269472", 800, 100, 200), box("8-Sep-26", 1030, 100, 120),
        box("Acme Chem India", 60, 75), box("12 Industrial Road, Town", 60, 100), box("GSTIN/UIN: 27AAPFU0939F1ZV", 60, 125),
        box("State Name : Uttarakhand, Code : 05", 60, 150),
        box("Buyer (Bill to)", 60, 200, 200), box("SHREE TRADERS PUNJAB", 60, 225), box("VILL: ABC, DISTT: XYZ", 60, 250),
        box("GSTIN/UIN : 27AAPFU0939F1ZV", 60, 275), box("Place of Supply : Punjab", 60, 300),
        box("Destination", 900, 330, 150), box("PUNJAB", 900, 356, 100),
        box("Motor Vehicle No.", 900, 380, 200), box("UK18CA7485", 900, 406, 150),
        box("Description of Goods", 330, 520, 250),
        box("1 ADF R-105", 90, 570, 200), box("(280BAGSX25KGS)", 90, 600, 200),
        box("Total", 480, 1100, 80), box(qty, 700, 1100, 250), box("₹ 1,24,950.00", 1000, 1105, 200),
        box("Total", 600, 1300, 80), box("1,19,000.00 5,950.00", 900, 1300, 300),   # tax-summary "Total": no quantity
    ]


class LayoutTests(unittest.TestCase):
    def test_bill_to_is_used_as_consignee_when_there_is_no_ship_to_block(self):
        r = extract(bill_to_only_invoice())
        f = r["fields"]
        self.assertTrue(f["consigneeAddress"].startswith("SHREE TRADERS PUNJAB"))
        self.assertNotIn("Place of Supply", f["consigneeAddress"])
        self.assertEqual(f["consigneeGstin"], "27AAPFU0939F1ZV")
        self.assertTrue(f["consignorAddress"].startswith("Acme Chem India"))
        self.assertTrue(any("no Ship-to block" in w for w in r["warnings"]))

    def test_weight_total_bags_and_goods_from_a_kg_invoice(self):
        f = extract(bill_to_only_invoice())["fields"]
        self.assertEqual(f["actualWt"], "7000 KG")
        self.assertEqual(f["declaredValue"], "124950")     # never the 7,000 kg quantity or the tax-summary row
        self.assertEqual((f["packages"], f["methodOfPacking"]), ("280", "Bags"))
        self.assertEqual(f["description"], "ADF R-105")
        self.assertEqual((f["invoiceNoDate"], f["invoiceDate"], f["lorryNo"], f["to"]), ("214", "2026-09-08", "UK18CA7485", "Punjab"))

    def test_pieces_total_next_to_an_area_quantity(self):
        f = extract(bill_to_only_invoice("PCS"))["fields"]
        self.assertEqual(f["packages"], "654")
        self.assertNotIn("actualWt", f)


if __name__ == "__main__":
    unittest.main()
