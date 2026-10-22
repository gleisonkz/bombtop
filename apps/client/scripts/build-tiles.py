"""Arena tiles (TILES in render/sprites.ts): grass A (plain, flowers, pebbles), grass B (darker),
block, pillar, border, the block burning away (6 frames); 128x128, computed as smooth shaders on a 32-unit design grid at 2x and
scaled down. Grass noise wraps every
tile so neighbours join seamlessly.
Usage: python build-tiles.py public/sprites/tiles.png preview.png  (needs Pillow, numpy)"""
import math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 128
SS = 2
N = OUT * SS              # computed size
K = N / 32                # px per design unit

ys, xs = np.mgrid[0:N, 0:N]
UX = (xs + 0.5) / K       # design-unit coordinates, 0..32
UY = (ys + 0.5) / K

def smooth(a, b, t):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def mix(a, b, t):
    t = np.asarray(t, float)
    if t.ndim == 2:
        t = t[..., None]
    return a * (1 - t) + b * t

def periodic_noise(seed, cells, x=UX, y=UY):
    """Smooth value noise repeating every 32 units."""
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    fx, fy = x / 32 * cells, y / 32 * cells
    x0, y0 = np.floor(fx).astype(int) % cells, np.floor(fy).astype(int) % cells
    x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
    tx, ty = fx - np.floor(fx), fy - np.floor(fy)
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a = g[y0, x0] * (1 - tx) + g[y0, x1] * tx
    b = g[y1, x0] * (1 - tx) + g[y1, x1] * tx
    return a * (1 - ty) + b * ty

def fbm(seed, x=UX, y=UY):
    return (periodic_noise(seed, 4, x, y) + periodic_noise(seed + 1, 8, x, y) * 0.5 + periodic_noise(seed + 2, 16, x, y) * 0.25 + periodic_noise(seed + 3, 32, x, y) * 0.125) / 1.875

def to_img(col, alpha=None):
    a = np.full(col.shape[:2], 255.0) if alpha is None else alpha
    arr = np.dstack([np.clip(col, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")

def finish(img):
    return img.resize((OUT, OUT), Image.LANCZOS)

def C(*rgb):
    return np.array(rgb, float)

# --- grass -------------------------------------------------------------------------------

def grass(shade, variant):
    k = 1.0 if shade == 0 else 0.86
    dark, mid, light = C(30, 84, 40) * k, C(52, 124, 58) * k, C(86, 164, 80) * k
    n = fbm(shade * 10) * 0.7 + fbm(shade * 10 + 5) * 0.3
    col = mix(dark, mid, smooth(0.25, 0.5, n))
    col = mix(col, light, smooth(0.58, 0.8, n) * 0.8)
    # fine streaks, like mown lawn
    streak = periodic_noise(shade * 10 + 7, 32, UX * 0.5, UY * 4 % 32)
    col = col * (0.94 + streak[..., None] * 0.1)
    img = to_img(col)
    d = ImageDraw.Draw(img)
    r = random.Random(100 + shade * 10 + variant)
    for _ in range(46):  # blades with a lit tip, wrapped at the edges
        x, y = r.uniform(0, 32), r.uniform(0, 32)
        h, lean = r.uniform(1.6, 3.2), r.uniform(-0.8, 0.8)
        for ox in (-32, 0, 32):
            for oy in (-32, 0, 32):
                bx, by = (x + ox) * K, (y + oy) * K
                tip = (bx + lean * K, by - h * K)
                d.line([(bx, by), tip], fill=tuple(int(v) for v in dark * 0.9) + (255,), width=max(1, int(K * 0.45)))
                d.line([((bx + tip[0]) / 2, (by + tip[1]) / 2), tip], fill=tuple(int(v) for v in light * 1.1) + (255,), width=max(1, int(K * 0.3)))
    if variant == 1:  # flowers
        for _ in range(3):
            fx, fy = r.uniform(5, 27), r.uniform(5, 27)
            petal = r.choice(((250, 250, 245), (255, 214, 80), (240, 150, 200)))
            d.ellipse([(fx - 1.2) * K, (fy + 0.8) * K, (fx + 1.6) * K, (fy + 1.8) * K], fill=tuple(int(v) for v in dark) + (160,))
            for a in range(5):
                px, py = fx + math.cos(a * 1.2566) * 0.9, fy + math.sin(a * 1.2566) * 0.9
                d.ellipse([(px - 0.7) * K, (py - 0.7) * K, (px + 0.7) * K, (py + 0.7) * K], fill=petal + (255,))
            d.ellipse([(fx - 0.5) * K, (fy - 0.5) * K, (fx + 0.5) * K, (fy + 0.5) * K], fill=(240, 160, 40, 255))
    if variant == 2:  # pebbles
        for _ in range(3):
            sx, sy, w = r.uniform(4, 26), r.uniform(4, 26), r.uniform(1.4, 2.4)
            d.ellipse([(sx - w) * K, (sy - w * 0.4) * K, (sx + w * 1.1) * K, (sy + w * 0.9) * K], fill=tuple(int(v) for v in dark) + (180,))
            d.ellipse([(sx - w) * K, (sy - w * 0.7) * K, (sx + w) * K, (sy + w * 0.6) * K], fill=(150, 148, 140, 255))
            d.ellipse([(sx - w * 0.6) * K, (sy - w * 0.55) * K, (sx + w * 0.1) * K, (sy - w * 0.05) * K], fill=(200, 198, 188, 255))
    return finish(img)

# --- block: breakable bricks -----------------------------------------------------------------

def block():
    TOP = 8
    top_c, brick, mortar = C(222, 160, 104), C(176, 86, 50), C(84, 46, 36)
    n = fbm(40)
    col = np.zeros((N, N, 3))
    top = UY < TOP
    tcol = top_c * (0.88 + n[..., None] * 0.25)
    edge = smooth(1.2, 0.0, np.minimum(UX, UY))[..., None]           # lit rim, top and left
    tcol = mix(tcol, C(255, 238, 205), edge * 0.6)
    tcol = mix(tcol, top_c * 0.7, smooth(TOP - 1.2, TOP, UY)[..., None])  # front edge
    col[top] = tcol[top]
    # brick courses: 6 units tall, staggered by 8
    fy = UY - TOP
    row = np.floor(fy / 6)
    ly = fy - row * 6
    ox = np.where(row % 2 == 0, 0, 8)
    bx = (UX + ox) % 16
    bid = (np.floor((UX + ox) / 16) * 7 + row * 13) % 5
    tone = 0.86 + bid[..., None] * 0.06
    bcol = brick * tone * (0.9 + fbm(41)[..., None] * 0.22)
    bcol = mix(bcol, C(255, 196, 160), smooth(1.4, 0.2, ly)[..., None] * 0.4)    # lit top of each brick
    bcol = mix(bcol, bcol * 0.7, smooth(4.2, 5.4, ly)[..., None])              # shaded bottom
    bcol = mix(bcol, C(255, 196, 160), smooth(1.0, 0.0, bx - 0.6)[..., None] * 0.2)
    m = np.maximum(smooth(0.75, 0.35, ly - 5.25 + 0.0) * (ly > 5.0), smooth(0.7, 0.3, bx))
    m = np.maximum(m, (ly > 5.4).astype(float))
    fcol = mix(bcol, mortar * (0.9 + n[..., None] * 0.2), m[..., None])
    col[~top] = fcol[~top]
    col = mix(col, col * 0.62, smooth(30.8, 32, UX)[..., None])  # right side in shade
    col = mix(col, C(60, 30, 24), smooth(31.0, 32, UY)[..., None])
    img = to_img(col)
    d = ImageDraw.Draw(img)
    for pts in (((22, 10), (21.4, 12), (22.6, 13.5), (21.8, 15.5)), ((6, 22), (6.8, 24), (6.1, 25.6))):  # cracks
        d.line([(x * K, y * K) for x, y in pts], fill=tuple(int(v) for v in mortar) + (255,), width=int(K * 0.5), joint="curve")
    return finish(img)

# --- burning block: six frames from the fire reaching it to ash -------------------------------
# struck (flash, glowing seams) > ablaze (charring, fire licking up) > breaking (chunks split, seams
# of fire) > collapsing (chunks sink into a glowing heap) > embers (heap and smoke) > ash (fading).

BURN_FRAMES = 6
HEAT = [  # same ramp as the flames (build-flames.py): dark rim to white-hot core
    (0.00, (110, 18, 8)), (0.16, (214, 52, 28)), (0.40, (255, 122, 26)),
    (0.64, (255, 210, 63)), (0.84, (255, 248, 210)), (1.00, (255, 255, 240)),
]
CHAR, EMBER, ASH = C(46, 28, 24), C(255, 120, 30), C(70, 64, 62)

def heat_rgb(h):
    hh = np.clip(h, 0, 1) ** 1.6
    col = np.zeros(h.shape + (3,))
    for (t0, c0), (t1, c1) in zip(HEAT, HEAT[1:]):
        f = np.clip((hh - t0) / (t1 - t0), 0, 1)[..., None]
        seg = (hh >= t0) & (hh <= t1)
        col = np.where(seg[..., None], C(*c0) * (1 - f) + C(*c1) * f, col)
    return col

def tongues(sources, seed):
    """Heat of flame tongues: (base x, base y, half width, height) in design units, each tapering to a
    wavering tip, licked by noise."""
    h = np.full((N, N), -1.0)
    n = fbm(seed) - 0.5
    for i, (x, y, w, tall) in enumerate(sources):
        up = np.clip((y - UY) / tall, -0.4, 1.2)                       # 0 at the base, 1 at the tip
        sway = np.sin(up * 4.2 + i * 1.7 + seed) * w * 0.35 * up
        half = w * np.where(up < 0, np.sqrt(np.clip(1 - (up / 0.4) ** 2, 0, 1)), np.clip(1 - up, 0, 1) ** 0.8)
        across = 1 - np.abs(UX - x - sway + n * 3 * up) / np.maximum(half, 1e-3)
        h = np.maximum(h, np.where(half > 0.05, across * (1 - np.clip(up, 0, 1) * 0.55) + n * 0.25, -1))
    return h

def over(col, a, top, ta):
    """(top, ta) over (col, a); alphas 0..1."""
    out = ta + a * (1 - ta)
    safe = np.where(out > 0, out, 1)[..., None]
    return (top * ta[..., None] + col * (a * (1 - ta))[..., None]) / safe, out

def burning():
    src = np.asarray(block().resize((N, N), Image.LANCZOS)).astype(float)
    bcol = src[..., :3]
    r = random.Random(7)
    pts = [(r.uniform(4, 28), r.uniform(4, 28)) for _ in range(8)]
    owner = np.argmin(np.stack([(UX - x) ** 2 + (UY - y) ** 2 for x, y in pts]), axis=0)
    # how far each pixel is from its chunk's edge (design units), for seams of fire between chunks
    dist = np.sort(np.stack([np.sqrt((UX - x) ** 2 + (UY - y) ** 2) for x, y in pts]), axis=0)
    seam = (dist[1] - dist[0]) / 2
    veins = smooth(0.12, 0.0, np.abs(fbm(33) - 0.5))                     # glowing cracks in the char
    # per frame: char amount, seam glow, gap between chunks, chunk spread, collapse (0 standing, 1 flat on
    # the floor), shrink, fire, smoke
    LIFE = [
        (0.10, 0.9, 0.0, 0.0, 0.0, 1.00, [(16, 10, 6, 9), (8, 12, 3.5, 6), (24, 12, 3.5, 6)], 0.0),
        (0.50, 1.0, 0.0, 0.0, 0.0, 1.00, [(16, 16, 8, 16), (7, 18, 5, 11), (25, 17, 5, 12)], 0.0),
        (0.75, 1.0, 0.7, 1.2, 0.06, 0.96, [(15, 18, 7, 15), (8, 21, 4.5, 10), (24, 20, 5, 11)], 0.0),
        (0.88, 0.8, 0.9, 1.6, 0.5, 0.8, [(16, 25, 6, 11), (10, 27, 3.5, 6), (22, 27, 3.5, 7)], 0.25),
        (0.95, 0.5, 1.0, 2.2, 0.78, 0.55, [(16, 28, 3.5, 6)], 0.45),
        (1.00, 0.0, 0.0, 0.0, 0.0, 0.0, [], 0.3),
    ]
    frames = []
    for f, (char, glow, gap, spread, collapse, shrink, fire, smoke) in enumerate(LIFE):
        col = np.zeros((N, N, 3))
        a = np.zeros((N, N))
        # a collapsing heap is a rounded mound, not the block's square outline
        mound = np.ones((N, N), bool)
        if collapse > 0.3:
            top, half = 31 - 30 * (1 - collapse) * 1.05, 16 - collapse * 6
            mound = UY > top + (31 - top) * ((UX - 16) / half) ** 2 + (fbm(50) - 0.5) * 3
        if shrink > 0:
            for i, (px, py) in enumerate(pts):
                cx = 16 + (px - 16) * (1 + spread / 16) * (0.6 + shrink * 0.4)
                cy = 31 - (31 - py) * (1 - collapse)
                sx = (UX - cx) / shrink + px
                sy = (UY - cy) / shrink + py
                ix = np.clip((sx * K).astype(int), 0, N - 1)
                iy = np.clip((sy * K).astype(int), 0, N - 1)
                inside = (sx >= 0) & (sx < 32) & (sy >= 0) & (sy < 32) & (owner[iy, ix] == i) & (seam[iy, ix] > gap * 0.5) & mound
                c = mix(bcol[iy, ix], CHAR, char)
                c = mix(c, EMBER, (veins[iy, ix] * char * 0.9))                       # cracks glow through the char
                c = mix(c, heat_rgb(np.full((N, N), 0.75)), smooth(0.9 + gap, 0.0, seam[iy, ix]) * glow)  # hot seams
                col = np.where(inside[..., None], c, col)
                a = np.where(inside, 1.0, a)
            if f == 0:  # struck: a hot flash over the whole block
                col = mix(col, C(255, 236, 190), 0.3)
        if f >= 3:  # a pool of embers glowing on the floor under the heap
            pool = smooth(1.0, 0.0, np.sqrt(((UX - 16) / [0, 0, 0, 13, 11, 9][f]) ** 2 + ((UY - 29.5) / 2.4) ** 2))
            col, a = over(col, a, heat_rgb(pool * [0, 0, 0, 0.55, 0.45, 0.25][f] + 0.1), pool * [0, 0, 0, 0.9, 0.8, 0.5][f])
        if f == 5:  # ash where the block stood
            ash = smooth(1.0, 0.3, np.sqrt(((UX - 16) / 12) ** 2 + ((UY - 28) / 3.4) ** 2)) * (0.65 + fbm(44) * 0.5)
            col, a = over(col, a, ASH * (0.7 + fbm(45)[..., None] * 0.4), np.clip(ash, 0, 1) * 0.8)
        if fire:
            h = tongues(fire, 70 + f)
            col, a = over(col, a, heat_rgb(h), np.clip(h / 0.06, 0, 1) * (0.75 if f == 0 else 1.0))
        if smoke:
            s = fbm(120 + f, UX, (UY + f * 6) % 32)
            plume = smooth(7, 1.5, np.abs(UX - 16 - (24 - UY) * 0.18)) * smooth(30, 8, UY) * smooth(4, 12, UY) * smooth(0.35, 0.7, s)
            col, a = over(col, a, np.broadcast_to(C(84, 78, 76), col.shape), plume * smoke)
        frames.append(finish(to_img(col, a * 255)))
    return frames

# --- pillar: unbreakable stone ----------------------------------------------------------------

def pillar():
    TOP = 22
    stone = C(138, 146, 170)
    n = fbm(60)
    grain = fbm(63, UX * 2 % 32, UY * 2 % 32)
    col = np.zeros((N, N, 3))
    top = UY < TOP
    t = stone * (0.9 + n[..., None] * 0.18 + grain[..., None] * 0.08)
    # bevel: light from the top left, shade to the bottom right
    lit = smooth(2.2, 0.0, np.minimum(UX, UY))
    dark = smooth(29.8, 32, UX) + smooth(TOP - 2.2, TOP, UY)
    t = mix(t, C(236, 240, 255), lit[..., None] * 0.55)
    t = mix(t, stone * 0.62, np.clip(dark, 0, 1)[..., None])
    # carved inset
    ix = (UX > 7) & (UX < 25) & (UY > 5) & (UY < 17)
    groove = ix & ((UX < 7.9) | (UY < 5.9))
    rim = ix & ((UX > 24.1) | (UY > 16.1))
    t[ix] = (stone * (0.84 + n[..., None] * 0.14))[ix]
    t[groove] = stone * 0.58
    t[rim] = mix(stone, C(236, 240, 255), 0.35)
    col[top] = t[top]
    f = stone * (0.6 + n[..., None] * 0.12) * (1 - (UY[..., None] - TOP) * 0.012)
    joint = (np.abs(UX - 10.5) < 0.35) | (np.abs(UX - 21.5) < 0.35)
    f[joint] *= 0.82
    f = mix(f, stone * 0.45, smooth(TOP + 0.9, TOP, UY)[..., None])
    f = mix(f, C(34, 36, 50), smooth(31.0, 32, UY)[..., None])
    col[~top] = f[~top]
    return finish(to_img(col))

# --- border: outer stone wall -----------------------------------------------------------------

def border():
    stone, mortar = C(104, 110, 136), C(44, 46, 64)
    n = fbm(80)
    row = np.floor(UY / 16)
    ly = UY - row * 16
    ox = np.where(row % 2 == 0, 0, 10)
    lx = (UX + ox) % 20
    bid = (np.floor((UX + ox) / 20) * 5 + row * 3) % 4
    s = stone * (0.86 + bid[..., None] * 0.07) * (0.88 + n[..., None] * 0.22)
    s = mix(s, C(220, 228, 255), (smooth(2.6, 0.6, ly) * 0.4 + smooth(1.6, 0.5, lx) * 0.18)[..., None])
    s = mix(s, s * 0.68, np.clip(smooth(13.6, 15.4, ly) + smooth(17.6, 19.4, lx), 0, 1)[..., None])
    m = np.maximum(smooth(0.9, 0.4, ly), smooth(0.9, 0.4, lx))
    col = mix(s, mortar, m[..., None])
    return finish(to_img(col))

def main():
    cells = [grass(0, 0), grass(0, 1), grass(0, 2), grass(1, 0), grass(1, 1), grass(1, 2), block(), pillar(), border(), *burning()]
    sheet = Image.new("RGBA", (OUT * len(cells), OUT))
    for i, c in enumerate(cells):
        sheet.paste(c, (i * OUT, 0))
    sheet.save(sys.argv[1])
    if len(sys.argv) > 2:
        W, H = 9, 7
        prev = Image.new("RGBA", (W * OUT, H * OUT))
        for y in range(H):
            for x in range(W):
                if x == 0 or y == 0:
                    c = 8
                elif x % 2 == 0 and y % 2 == 0:
                    c = 7
                elif (x * 7 + y * 3) % 5 == 0:
                    c = 6
                else:
                    c = (0 if (x + y) % 2 == 0 else 3) + [0, 0, 0, 1, 2][(x * 5 + y * 11) % 5]
                prev.paste(cells[c], (x * OUT, y * OUT))
        prev.resize((prev.width // 2, prev.height // 2), Image.LANCZOS).save(sys.argv[2])

main()
