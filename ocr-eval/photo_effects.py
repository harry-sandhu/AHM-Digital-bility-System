"""Makes a clean page (or a good photo) look like a real, imperfect phone photo."""
import io
import math
import random

import cv2
import numpy as np
from PIL import Image


def _coeffs(src, dst):
    """Perspective coefficients mapping dst quad -> src quad (PIL's convention)."""
    A = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = [c for p in src for c in p]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def photo_effects(img, rng, level="normal"):
    """Returns (image, params). level: 'light' | 'normal' | 'harsh'."""
    k = {"mild": 0.35, "light": 0.5, "normal": 1.0, "harsh": 1.6}[level]
    mild = level == "mild"   # a decent phone photo: slight tilt/shadow, good resolution, little blur
    img = img.convert("RGB")
    p = {}

    # --- geometry: crop a little, rotate, perspective, put on a desk ---
    if rng.random() < 0.3:
        W, H = img.size
        m = [rng.uniform(0, 0.05) for _ in range(4)]
        img = img.crop((int(W * m[0]), int(H * m[1]), int(W * (1 - m[2])), int(H * (1 - m[3]))))
        p["crop"] = [round(x, 3) for x in m]
    angle = rng.uniform(-7, 7) * k
    p["rotate"] = round(angle, 1)
    desk = tuple(rng.randint(40, 200) for _ in range(3))
    img = img.rotate(angle, expand=True, fillcolor=desk, resample=Image.BICUBIC)
    W, H = img.size
    j = rng.uniform(0.0, 0.05) * k
    p["perspective"] = round(j, 3)
    jit = lambda: (rng.uniform(-j, j) * W, rng.uniform(-j, j) * H)
    quad = [(0 + jit()[0], 0 + jit()[1]), (W + jit()[0], 0 + jit()[1]), (W + jit()[0], H + jit()[1]), (0 + jit()[0], H + jit()[1])]
    img = img.transform((W, H), Image.PERSPECTIVE, _coeffs(quad, [(0, 0), (W, 0), (W, H), (0, H)]),
                        Image.BICUBIC, fillcolor=desk)

    a = np.asarray(img).astype(np.float32)

    # --- uneven light: soft shadow blobs + gradient ---
    smin = 1.0 - rng.uniform(0.0, 0.45) * k
    p["shadow"] = round(1 - smin, 2)
    grid = np.random.default_rng(rng.randint(0, 2**31)).uniform(smin, 1.0, (4, 4)).astype(np.float32)
    shade = cv2.resize(grid, (W, H), interpolation=cv2.INTER_CUBIC)
    a *= np.clip(shade, 0.2, 1.0)[:, :, None]

    # --- brightness / contrast ---
    alpha = rng.uniform(0.6, 1.1) if rng.random() < 0.4 * k else rng.uniform(0.9, 1.05)
    beta = rng.uniform(-25, 10) if alpha < 0.9 else rng.uniform(-5, 5)
    p["contrast"], p["brightness"] = round(alpha, 2), round(beta, 1)
    a = a * alpha + beta

    # --- resolution ---
    scale = 1.0 if (rng.random() < 0.4 or mild) else rng.uniform(0.45, 1.0) ** (1 / max(k, 0.7))
    p["scale"] = round(scale, 2)
    if scale < 1.0:
        a = cv2.resize(np.clip(a, 0, 255), None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    # --- blur (out of focus or motion) ---
    r = rng.random()
    if r < 0.30:
        p["blur"] = 0
    elif r < 0.85:
        sig = rng.uniform(0.3, 1.1) * k if not mild else rng.uniform(0.0, 0.4)
        p["blur"] = round(sig, 2)
        a = cv2.GaussianBlur(a, (0, 0), sig)
    else:
        n = rng.randint(5, 13)
        kern = np.zeros((n, n), np.float32)
        kern[n // 2, :] = 1.0 / n
        M = cv2.getRotationMatrix2D((n / 2 - 0.5, n / 2 - 0.5), rng.uniform(0, 180), 1)
        kern = cv2.warpAffine(kern, M, (n, n)); kern /= max(kern.sum(), 1e-6)
        a = cv2.filter2D(a, -1, kern)
        p["blur"] = f"motion{n}"

    # --- sensor noise ---
    ns = rng.uniform(0, 9) * k if not mild else rng.uniform(0, 2.5)
    p["noise"] = round(ns, 1)
    if ns > 0.5:
        a = a + np.random.default_rng(rng.randint(0, 2**31)).normal(0, ns, a.shape)

    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    q = rng.randint(30, 95) if not mild else rng.randint(72, 95)
    p["jpeg"] = q
    buf = io.BytesIO(); out.save(buf, "JPEG", quality=q)
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB"), p, buf.getvalue()
