"""Smooths a pixel-art sheet for HD: Scale4x (Scale2x twice, which rounds staircase edges
without blurring), then scaled down to `factor` (default 2x the original) so the edges come
out anti-aliased. Frame positions scale by `factor` too.
Usage: python upscale-pixel-art.py in.png out.png [factor]  (needs Pillow, numpy)"""
import sys
import numpy as np
from PIL import Image

def scale2x(a):
    """EPX/Scale2x on an RGBA array (h, w, 4)."""
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode="edge")
    E = p[1:-1, 1:-1]
    B, H = p[:-2, 1:-1], p[2:, 1:-1]
    D, F = p[1:-1, :-2], p[1:-1, 2:]
    eq = lambda x, y: np.all(x == y, axis=2)
    BF, DH, DB, HF = eq(B, F), eq(D, H), eq(D, B), eq(H, F)
    c0 = (DB & ~BF & ~DH)[..., None]
    c1 = (eq(B, F) & ~DB & ~HF)[..., None]
    c2 = (DH & ~DB & ~HF)[..., None]
    c3 = (HF & ~DH & ~BF)[..., None]
    E0, E1, E2, E3 = np.where(c0, D, E), np.where(c1, F, E), np.where(c2, D, E), np.where(c3, F, E)
    h, w = a.shape[:2]
    out = np.zeros((h * 2, w * 2, 4), a.dtype)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = E0, E1, E2, E3
    return out

def main():
    src = Image.open(sys.argv[1]).convert("RGBA")
    factor = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    a = scale2x(scale2x(np.asarray(src)))
    big = Image.fromarray(a, "RGBA")
    # premultiply so transparent pixels don't bleed dark fringes when shrinking
    arr = np.asarray(big).astype(float)
    arr[..., :3] *= arr[..., 3:4] / 255
    pre = Image.fromarray(arr.astype(np.uint8), "RGBA")
    out = pre.resize((src.width * factor, src.height * factor), Image.LANCZOS)
    o = np.asarray(out).astype(float)
    alpha = o[..., 3:4]
    o[..., :3] = np.where(alpha > 0, o[..., :3] * 255 / np.maximum(alpha, 1), 0)
    Image.fromarray(np.clip(o, 0, 255).astype(np.uint8), "RGBA").save(sys.argv[2])

main()
