"""Is the photo good enough to read? Cheap checks before spending OCR time.

A photo that is too blurry/dark/small produces blanks and, worse, a few
confidently wrong values, so the user is asked to retake it instead.
"""
import cv2
import numpy as np

# Calibrated on real photos vs. deliberately degraded copies (see ocr-eval/).
MIN_SHARPNESS = float(__import__("os").environ.get("OCR_MIN_SHARPNESS", "80"))
MIN_BRIGHTNESS = float(__import__("os").environ.get("OCR_MIN_BRIGHTNESS", "70"))
# Camera shake blurs in one direction only, so the page still measures "sharp".
# Compare edge strength along 4 directions: a sharp page is fairly even (real
# photos here: 0.48-0.73), a shaken one is lopsided (typically ~0.3).
MIN_DIRECTION_RATIO = float(__import__("os").environ.get("OCR_MIN_DIRECTION_RATIO", "0.38"))
# Pristine digital pages (PDF renders, screenshots, flatbed scans) are far sharper than any
# photo and are all straight lines, which looks "lopsided" to the shake test. Real shaken
# photos measure well below this, so only test for shake when the image isn't that crisp.
SHAKE_TEST_MAX_SHARPNESS = float(__import__("os").environ.get("OCR_SHAKE_MAX_SHARPNESS", "2500"))
MIN_LONG_SIDE = int(__import__("os").environ.get("OCR_MIN_LONG_SIDE", "900"))


def metrics(img):
    """PIL image -> (sharpness, brightness, long_side, direction_ratio).
    Sharpness = variance of the Laplacian on a copy normalised to a 1000 px long
    side, so it doesn't depend on the phone's resolution."""
    gray = np.asarray(img.convert("L"))
    h, w = gray.shape
    long_side = max(h, w)
    if long_side != 1000:
        s = 1000 / long_side
        gray = cv2.resize(gray, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # paper is the bright part of the picture: use a high percentile, not the mean
    bright = float(np.percentile(gray, 90))

    def edge_energy(g):
        gx = cv2.Sobel(g, cv2.CV_64F, 1, 0, ksize=3)
        gy = cv2.Sobel(g, cv2.CV_64F, 0, 1, ksize=3)
        return float(np.percentile(gx ** 2, 98)), float(np.percentile(gy ** 2, 98))

    rot = cv2.warpAffine(gray, cv2.getRotationMatrix2D((gray.shape[1] / 2, gray.shape[0] / 2), 45, 1),
                         (gray.shape[1], gray.shape[0]), borderMode=cv2.BORDER_REPLICATE)
    energies = [*edge_energy(gray), *edge_energy(rot)]
    ratio = min(energies) / max(max(energies), 1e-9)
    return sharp, bright, long_side, ratio


def assess(img):
    sharp, bright, long_side, ratio = metrics(img)
    reasons = []
    if sharp < MIN_SHARPNESS:
        reasons.append("the photo is blurry")
    elif ratio < MIN_DIRECTION_RATIO and sharp < SHAKE_TEST_MAX_SHARPNESS:
        reasons.append("the photo is blurred by camera shake")
    if bright < MIN_BRIGHTNESS:
        reasons.append("the photo is too dark")
    if long_side < MIN_LONG_SIDE:
        reasons.append("the photo resolution is too low")
    return {"sharpness": round(sharp, 1), "brightness": round(bright, 1), "longSide": long_side, "directionRatio": round(ratio, 2), "reasons": reasons}
