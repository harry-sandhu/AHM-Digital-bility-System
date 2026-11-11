import unittest

import cv2
import numpy as np
from PIL import Image

import quality


def page(blur=None):
    """A white page of crisp horizontal and vertical strokes, like printed text."""
    g = np.full((1400, 1000), 255, np.uint8)
    rng = np.random.default_rng(1)
    for _ in range(260):
        x, y = int(rng.integers(40, 900)), int(rng.integers(40, 1300))
        n = int(rng.integers(30, 60))
        w, h = (n, 4) if rng.random() < 0.5 else (4, n)   # equally many horizontal and vertical strokes
        g[y:y + h, x:x + w] = 0
    if blur == "gauss":
        g = cv2.GaussianBlur(g, (0, 0), 3.0)
    elif blur == "shake":
        k = np.zeros((15, 15), np.float32); k[7, :] = 1 / 15
        g = cv2.filter2D(g, -1, k)
    return Image.fromarray(g).convert("RGB")


class QualityTests(unittest.TestCase):
    def test_sharp_page_is_accepted(self):
        self.assertEqual(quality.assess(page())["reasons"], [])

    def test_out_of_focus_page_is_rejected(self):
        self.assertTrue(quality.assess(page("gauss"))["reasons"])

    def test_camera_shake_is_rejected_even_though_it_measures_sharp(self):
        result = quality.assess(page("shake"))
        self.assertTrue(any("shake" in r or "blurry" in r for r in result["reasons"]), result)

    def test_dark_and_tiny_photos_are_rejected(self):
        dark = Image.fromarray((np.asarray(page().convert("L")) * 0.2).astype(np.uint8)).convert("RGB")
        self.assertTrue(any("dark" in r for r in quality.assess(dark)["reasons"]))
        self.assertTrue(any("resolution" in r for r in quality.assess(page().resize((300, 420)))["reasons"]))


if __name__ == "__main__":
    unittest.main()
