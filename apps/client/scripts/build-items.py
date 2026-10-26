"""The first power-up sheet (items.png is now packed from concept art by pack-concept-items.py, which
takes only the picanha icon from here). Power-up sheet in HD: one 192x192 column per item (order = ITEMS.order in render/sprites.ts),
rows = plain, then 3 frames of a glint sweeping across the plate. Designed on a 48-unit grid
(4 px per unit). Each item is a beveled plate in its own color with a glossy icon on top; the
bomb items reuse the active atlas from bombs/armed.png.
Usage: python build-items.py public/sprites/bombs/armed.png public/sprites/items.png preview.png  (needs Pillow, numpy, scipy)"""
import math, sys
import numpy as np
from PIL import Image
from hd import Canvas, INK, WHITE, smooth

UNITS, PX, FRAMES = 48, 4, 4
SIZE = UNITS * PX

PLATES = {
    "bomb": "#3d7bf2", "fire": "#e84a4a", "fullFire": "#f5b700", "speed": "#3cba54",
    "kick": "#8e5ae0", "remote": "#4a5578", "pierce": "#23a9b5", "punch": "#f08a24",
    "glove": "#a0703c", "skull": "#2a1838", "egg": "#ec8cc0",
    "picanha": "#d9822b",
}
ORDER = ["bomb", "fire", "fullFire", "speed", "kick", "remote", "pierce", "punch", "glove", "skull", "egg", "picanha"]

def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)

# --- plate --------------------------------------------------------------------------------

def plate(color, glint):
    """Rounded plate: ink rim, beveled frame (lit top left, shaded bottom right), a groove and a
    sunken field glowing behind the icon. `glint` (0..1 or None) sweeps a diagonal shine."""
    ss = 2
    n = SIZE * ss
    k = n / UNITS
    ys, xs = np.mgrid[0:n, 0:n]
    x, y = (xs + 0.5) / k, (ys + 0.5) / k
    cx, cy, hw, r = 24.0, 24.0, 21.5, 9.0
    qx, qy = np.abs(x - cx) - (hw - r), np.abs(y - cy) - (hw - r)
    sd = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r  # <0 inside
    base = rgb(color)
    white = np.array([255.0, 255, 255])
    lit = smooth(-6, 6, (cx - x) + (cy - y))[..., None]  # 1 toward the top left
    frame = (base * 0.62) * (1 - lit) + (base + (white - base) * 0.22) * lit
    frame = np.where((y > 40.5)[..., None], base * 0.45, frame)  # lip under the plate
    d = np.hypot(x - 23.5, y - 22) / 20
    field = base * (1.0 - 0.18 * smooth(0.2, 1.0, d))[..., None]
    field = field + (white - field) * (0.28 * smooth(0.55, 0.0, d))[..., None]
    col = np.where((sd < -6.2)[..., None], field, np.where((sd < -5.2)[..., None], base * 0.5, frame))
    if glint is not None:
        g = (x + y) - (glint * (2 * UNITS + 16) - 8)
        shine = (smooth(3.2, 0.8, np.abs(g)) * 0.6)[..., None]
        col = col + (white - col) * shine * (sd < -2).astype(float)[..., None]
    col = np.where((sd > -2)[..., None], np.array([21.0, 21, 42]), col)
    alpha = smooth(0.6, -0.6, sd) * 255
    arr = np.dstack([np.clip(col, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA").resize((SIZE, SIZE), Image.LANCZOS)

# --- icons --------------------------------------------------------------------------------

def flame_points(cx, by, w, h, k=1.0):
    tongues = [
        (cx - w, by), (cx - w * 1.05, by - h * 0.35), (cx - w * 0.55, by - h * 0.62),
        (cx - w * 0.6, by - h * 0.35), (cx - w * 0.15, by - h * 0.78), (cx, by - h),
        (cx + w * 0.3, by - h * 0.6), (cx + w * 0.55, by - h * 0.8), (cx + w * 0.75, by - h * 0.35),
        (cx + w * 1.05, by - h * 0.42), (cx + w, by),
    ]
    bottom = [(cx + math.cos(a) * w, by + math.sin(a) * w * 0.85) for a in [math.pi * i / 20 for i in range(1, 20)]]
    return [(cx + (x - cx) * k, by + (y - by) * k + (1 - k) * w * 0.4) for x, y in tongues + bottom]

def face(c, cx, cy, grin=False):
    for ex in (cx - 3.3, cx + 3.3):
        c.d.ellipse(c.box(ex, cy, 1.1, 1.9), fill=INK)
        c.d.ellipse(c.box(ex + 0.3, cy - 0.7, 0.4, 0.4), fill=WHITE)
    if grin:
        c.d.chord(c.box(cx, cy + 2.6, 3.4, 2.8), 0, 180, fill=INK)
        c.d.ellipse(c.box(cx, cy + 4.3, 1.4, 0.7), fill=(255, 110, 110, 255))
    else:
        c.d.arc(c.box(cx, cy + 2.2, 2.6, 1.8), 20, 160, fill=INK, width=int(c.k * 0.6))

def fire_icon(cx, by, w, h, grin):
    c = Canvas(UNITS, PX)
    m, d = c.mask()
    d.polygon(c.pts(flame_points(cx, by, w, h)), fill=255)
    c.outline(m, 0.9)
    for color, k, radius, gloss in (((240, 70, 30), 1.0, 5, True), ((255, 150, 30), 0.72, 3, False), ((255, 225, 90), 0.45, 3, False)):
        m, d = c.mask()
        d.polygon(c.pts(flame_points(cx, by, w, h, k)), fill=255)
        c.volume(m, color, radius=radius, deep=0.7, light=1.2, gloss=gloss)
    face(c, cx, by - 2, grin)
    return c

def icon_fire():
    return fire_icon(24, 31, 11, 27, grin=False).done()

def icon_full_fire():
    c = fire_icon(24, 32, 13, 30, grin=True)
    for sx, sy, s in [(9, 12, 3.2), (38.5, 9, 3.2), (40.5, 25, 2.2)]:
        c.star(sx, sy, s, s * 0.32, WHITE, points=4)
    return c.done()

def shape(c, draw, color, outline=0.9, **kw):
    m, d = c.mask()
    draw(d)
    if outline:
        c.outline(m, outline)
    c.volume(m, color, **kw)

def icon_speed():
    c = Canvas(UNITS, PX)
    shape(c, lambda d: d.polygon(c.pts([(14, 15), (25, 15), (27, 23), (36, 26), (39, 31), (39, 34), (13, 34), (12, 23)]), fill=255), (245, 245, 252), radius=5)
    shape(c, lambda d: d.polygon(c.pts([(16, 25), (25, 21), (28, 25), (18, 30)]), fill=255), (232, 60, 60), outline=0, radius=1.5, gloss=False)
    shape(c, lambda d: d.rounded_rectangle(c.box(25.5, 35, 14.5, 3), radius=c.k * 1.5, fill=255), (210, 50, 50), radius=1.6, gloss=False)
    for x in (17, 21):
        c.d.line(c.pts([(x, 17), (x + 3, 20)]), fill=INK, width=int(c.k * 0.6))
    for y, x0 in [(19, 2.5), (25, 1), (31, 3.5)]:
        c.d.rounded_rectangle(c.box(x0 + 3, y, 3.2, 0.8), radius=c.k * 0.8, fill=WHITE)
    return c.done()

def icon_kick():
    c = Canvas(UNITS, PX)
    shape(c, lambda d: d.polygon(c.pts([(13, 9), (24, 9), (24, 24), (34, 26), (39, 30), (39, 36), (13, 36)]), fill=255), (160, 96, 50), radius=6)
    shape(c, lambda d: d.rounded_rectangle(c.box(26, 36.5, 14, 2.6), radius=c.k * 1.2, fill=255), (70, 42, 24), radius=1.4, gloss=False)
    shape(c, lambda d: d.rounded_rectangle(c.box(18.5, 9.5, 7.5, 2.6), radius=c.k * 1.2, fill=255), (215, 160, 95), radius=1.4, gloss=False)
    for y in (16, 21):
        c.d.line(c.pts([(16, y), (21, y)]), fill=(245, 228, 180, 255), width=int(c.k * 0.7))
    c.d.arc(c.box(34, 16, 7, 7), 200, 330, fill=WHITE, width=int(c.k * 1.2))
    return c.done()

def icon_punch():
    c = Canvas(UNITS, PX)
    shape(c, lambda d: d.rounded_rectangle(c.box(12, 24, 6, 10), radius=c.k * 3, fill=255), (240, 240, 248), radius=3, gloss=False)
    def fist(d):
        d.ellipse(c.box(28.5, 22.5, 12.5, 13.5), fill=255)
        d.ellipse(c.box(18.5, 26.5, 6.5, 6.5), fill=255)
    shape(c, fist, (228, 40, 40), radius=9)
    c.d.arc(c.box(18.5, 26.5, 6.5, 6.5), 200, 330, fill=(140, 20, 20, 255), width=int(c.k * 0.6))
    for y in (19, 24, 29):
        c.d.line(c.pts([(9, y), (14, y)]), fill=(170, 170, 190, 255), width=int(c.k * 0.6))
    return c.done()

def icon_glove():
    c = Canvas(UNITS, PX)
    def hand(d):
        d.rounded_rectangle(c.box(24, 28.5, 10, 8.5), radius=c.k * 5, fill=255)
        for x, top in [(16, 8), (21, 5), (26, 5), (31, 8)]:
            d.rounded_rectangle([c.u(x - 2.2), c.u(top), c.u(x + 2.2), c.u(25)], radius=c.k * 2.2, fill=255)
        d.polygon(c.pts([(32, 26), (38, 17), (41.5, 19.5), (36, 31)]), fill=255)
    shape(c, hand, (235, 242, 255), radius=4)
    shape(c, lambda d: d.rounded_rectangle(c.box(24, 38, 11, 3), radius=c.k * 1.4, fill=255), (60, 120, 230), radius=1.6, gloss=False)
    for x in (18.5, 23.5, 28.5):
        c.d.line(c.pts([(x, 9), (x, 22)]), fill=(150, 160, 190, 255), width=int(c.k * 0.5))
    return c.done()

def icon_skull():
    c = Canvas(UNITS, PX)
    def head(d):
        d.ellipse(c.box(24, 19.5, 14, 13.5), fill=255)
        d.rounded_rectangle(c.box(24, 32.5, 9, 7.5), radius=c.k * 4, fill=255)
    shape(c, head, (240, 236, 214), radius=9)
    for x in (18.5, 29.5):
        c.d.ellipse(c.box(x, 21, 3.6, 4.2), fill=INK)
        c.glow(x - 0.8, 20.2, 1.0, (140, 255, 120, 200), blur=0.4)
    c.d.polygon(c.pts([(24, 26), (22, 30), (26, 30)]), fill=INK)
    for x in (19.5, 24, 28.5):
        c.d.line(c.pts([(x, 34), (x, 39.5)]), fill=INK, width=int(c.k * 0.6))
    return c.done()

def icon_egg():
    c = Canvas(UNITS, PX)
    shape(c, lambda d: d.ellipse(c.box(24, 23, 13, 18), fill=255), (255, 246, 222), radius=12)
    for x, y, r in [(18, 15, 3), (29, 21, 4), (19, 30, 3), (30, 34, 2)]:
        shape(c, lambda d, x=x, y=y, r=r: d.ellipse(c.box(x, y, r, r), fill=255), (90, 190, 80), outline=0, radius=r * 0.8, gloss=False)
    return c.done()

def icon_picanha():
    """Lula's promise: a juicy picanha on a skewer, its fat cap on top, grill marks across it."""
    c = Canvas(UNITS, PX)
    c.d.line(c.pts([(6, 42), (42, 6)]), fill=INK, width=int(c.k * 2.2))
    c.d.line(c.pts([(6, 42), (42, 6)]), fill=(205, 205, 215, 255), width=int(c.k * 1.1))
    def meat(d):
        d.polygon(c.pts([(8, 21), (20, 10), (37, 14), (41, 28), (31, 39), (10, 34)]), fill=255)
    shape(c, meat, (176, 62, 44), radius=7)
    def fat(d):
        d.polygon(c.pts([(8, 21), (20, 10), (37, 14), (38.5, 19), (21, 15.5), (10, 26)]), fill=255)
    shape(c, fat, (250, 238, 205), outline=0, radius=2, gloss=False)
    for x in (17, 24, 31):
        c.d.line(c.pts([(x - 4, 34), (x + 4, 21)]), fill=(70, 26, 18, 255), width=int(c.k * 1.3))
    c.d.line(c.pts([(37, 11), (42, 6)]), fill=(205, 205, 215, 255), width=int(c.k * 1.1))
    return c.done()

def bomb_icon(sheet, col):
    """A bomb from bombs/armed.png (128px cells), trimmed and scaled to fill the plate."""
    cell = sheet.crop((col * 128, 0, col * 128 + 128, 128))
    cell = cell.crop(cell.getbbox())
    k = (36 * PX) / max(cell.size)
    cell = cell.resize((round(cell.width * k), round(cell.height * k)), Image.LANCZOS)
    img = Image.new("RGBA", (SIZE, SIZE))
    img.alpha_composite(cell, ((SIZE - cell.width) // 2, (SIZE - cell.height) // 2 - PX))
    return img

def shadowed(icon):
    """Soft drop shadow under an icon so it stands off the plate."""
    from PIL import ImageFilter
    a = icon.getchannel("A").filter(ImageFilter.GaussianBlur(PX * 0.6))
    sh = Image.new("RGBA", (SIZE, SIZE))
    sh.paste((0, 0, 0, 120), (PX, PX * 2), a)
    sh.alpha_composite(icon)
    return sh

def main():
    bombs = Image.open(sys.argv[1]).convert("RGBA")
    icons = {
        "bomb": bomb_icon(bombs, 0), "pierce": bomb_icon(bombs, 1), "remote": bomb_icon(bombs, 2),
        "fire": icon_fire(), "fullFire": icon_full_fire(), "speed": icon_speed(), "kick": icon_kick(),
        "punch": icon_punch(), "glove": icon_glove(), "skull": icon_skull(), "egg": icon_egg(),
        "picanha": icon_picanha(),
    }
    sheet = Image.new("RGBA", (SIZE * len(ORDER), SIZE * FRAMES))
    for col, kind in enumerate(ORDER):
        for f in range(FRAMES):
            cell = plate(PLATES[kind], None if f == 0 else f / FRAMES)
            cell.alpha_composite(shadowed(icons[kind]))
            sheet.paste(cell, (col * SIZE, f * SIZE))
    sheet.save(sys.argv[2])
    if len(sys.argv) > 3:
        prev = Image.new("RGBA", (SIZE * len(ORDER), SIZE * 2), (47, 107, 58, 255))
        prev.alpha_composite(sheet.crop((0, 0, SIZE * len(ORDER), SIZE)), (0, 0))
        prev.alpha_composite(sheet.crop((0, 2 * SIZE, SIZE * len(ORDER), 3 * SIZE)), (0, SIZE))
        prev.resize((prev.width // 2, prev.height // 2), Image.LANCZOS).save(sys.argv[3])

if __name__ == "__main__":
    main()
