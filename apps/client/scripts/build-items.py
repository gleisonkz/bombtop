"""Power-up sheet: one 48x48 column per item (order = ITEMS.order in render/sprites.ts),
rows = plain, then 3 frames of a glint sweeping across the plate.
Each item is a beveled plate in its own color with a glossy icon on top; the bomb items
reuse the real bomb sprites from bombs.png. Icon parts are drawn as flat masks and given
volume by `volume` (lit from the top left, a few tones, a white gloss), so they read as
chunky shaded pixel art.
Usage: python build-items.py public/sprites/bombs.png public/sprites/items.png preview.png  (needs Pillow)"""
import math, sys
from PIL import Image, ImageDraw

N, FRAMES = 48, 4
INK = (21, 21, 42, 255)
WHITE = (255, 255, 255, 255)
LIGHT = (-0.55, -0.75, 0.9)  # top left, toward the viewer

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)

def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)

def tone(c, k):
    """k < 1 darkens, k > 1 lightens toward white (no clipping to flat yellow/white)."""
    return shade(c, k) if k <= 1 else mix(c, WHITE, min(1, (k - 1) * 1.8))

PLATES = {
    "bomb": "#3d7bf2", "fire": "#e84a4a", "fullFire": "#f5b700", "speed": "#3cba54",
    "kick": "#8e5ae0", "remote": "#4a5578", "pierce": "#23a9b5", "punch": "#f08a24",
    "glove": "#a0703c", "skull": "#2a1838", "egg": "#ec8cc0",
}
ORDER = ["bomb", "fire", "fullFire", "speed", "kick", "remote", "pierce", "punch", "glove", "skull", "egg"]

# --- plate -------------------------------------------------------------------

def inside_round(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def plate(color, glint):
    """Rounded plate: ink outline, a beveled frame (light top left, dark bottom right)
    around a sunken field that glows behind the icon. `glint` (0..1 or None) puts a
    diagonal shine stripe across it."""
    img = Image.new("RGBA", (N, N))
    px = img.load()
    base = rgb(color)
    x0, y0, x1, y1, r = 2, 2, 45, 45, 9
    for y in range(N):
        for x in range(N):
            p = (x + 0.5, y + 0.5)
            if not inside_round(*p, x0, y0, x1, y1, r):
                continue
            if not inside_round(*p, x0 + 2, y0 + 2, x1 - 2, y1 - 2, r - 2):
                c = INK
            elif not inside_round(*p, x0 + 5, y0 + 5, x1 - 5, y1 - 5, r - 4):
                # frame bevel: lit along the top and left, shaded along the bottom and right
                lit = (x1 - x) + (y1 - y) > (x - x0) + (y - y0)
                c = tone(base, 1.12 if lit else 0.62)
                if y >= y1 - 4:
                    c = tone(base, 0.45)  # lip under the plate
            elif not inside_round(*p, x0 + 6, y0 + 6, x1 - 6, y1 - 6, r - 5):
                c = tone(base, 0.5)  # groove between frame and field
            else:
                d = math.hypot(x - 23.5, y - 22) / 20
                c = tone(base, [1.28, 1.12, 0.98, 0.86][min(3, int(d * 4))])
            if glint is not None and c != INK:
                g = (x + y) - (glint * (2 * N + 16) - 8)
                if -3 <= g <= 3:
                    c = mix(c, WHITE, 0.75 if abs(g) <= 1 else 0.4)
            px[x, y] = c
    return img

# --- shading -----------------------------------------------------------------

def mask():
    img = Image.new("L", (N, N))
    return img, ImageDraw.Draw(img)

def volume(m, color, R=5, levels=(0.5, 0.68, 0.86, 1.0, 1.15), gloss=True):
    """Fills mask `m` with `color` as a puffy shape: rounded edges lit from the top left,
    stepped into a few tones, and a white gloss spot near its top left."""
    mp = m.load()
    inside = [[mp[x, y] > 127 for x in range(N)] for y in range(N)]
    INF = 99.0
    d = [[INF if inside[y][x] else 0.0 for x in range(N)] for y in range(N)]
    for y in range(N):  # chamfer distance to the outside
        for x in range(N):
            if d[y][x]:
                for dx, dy, w in ((-1, 0, 1), (0, -1, 1), (-1, -1, 1.4), (1, -1, 1.4)):
                    xx, yy = x + dx, y + dy
                    v = d[yy][xx] if 0 <= xx < N and 0 <= yy < N else 0
                    d[y][x] = min(d[y][x], v + w)
    for y in reversed(range(N)):
        for x in reversed(range(N)):
            if d[y][x]:
                for dx, dy, w in ((1, 0, 1), (0, 1, 1), (1, 1, 1.4), (-1, 1, 1.4)):
                    xx, yy = x + dx, y + dy
                    v = d[yy][xx] if 0 <= xx < N and 0 <= yy < N else 0
                    d[y][x] = min(d[y][x], v + w)

    def h(x, y):
        if not (0 <= x < N and 0 <= y < N) or not inside[y][x]:
            return 0.0
        t = min(d[y][x], R) / R
        return math.sqrt(1 - (1 - t) ** 2)  # quarter-circle bevel

    ln = math.sqrt(sum(v * v for v in LIGHT))
    L = [v / ln for v in LIGHT]
    out = Image.new("RGBA", (N, N))
    op = out.load()
    base = color if len(color) == 4 else color + (255,)
    for y in range(N):
        for x in range(N):
            if not inside[y][x]:
                continue
            gx, gy = (h(x + 1, y) - h(x - 1, y)) * R * 0.5, (h(x, y + 1) - h(x, y - 1)) * R * 0.5
            n = (-gx, -gy, 1.0)
            nl = math.sqrt(sum(v * v for v in n))
            lam = max(0.0, sum(a * b for a, b in zip(n, L)) / nl)
            k = 0.35 + 0.95 * lam
            op[x, y] = tone(base, min(levels, key=lambda lv: abs(lv - k)))
    if gloss:
        bb = m.getbbox()
        if bb:
            w, hh = bb[2] - bb[0], bb[3] - bb[1]
            gx, gy = bb[0] + w * 0.3, bb[1] + hh * 0.27
            rx, ry = max(1.5, w * 0.12), max(1.2, hh * 0.08)
            for y in range(N):
                for x in range(N):
                    if inside[y][x] and d[y][x] >= 2:
                        e = ((x + 0.5 - gx) / rx) ** 2 + ((y + 0.5 - gy) / ry) ** 2
                        if e <= 1:
                            op[x, y] = WHITE if e <= 0.45 else mix(op[x, y], WHITE, 0.6)
    return out

def outline(icon, width=1):
    """Ink outline around an icon's opaque pixels."""
    a = icon.getchannel("A").point(lambda v: 255 if v > 0 else 0)
    out = Image.new("RGBA", icon.size)
    for dx in range(-width, width + 1):
        for dy in range(-width, width + 1):
            if dx or dy:
                out.paste(INK, (dx, dy), a)
    out.alpha_composite(icon)
    return out

def layers(*parts):
    img = Image.new("RGBA", (N, N))
    for p in parts:
        img.alpha_composite(p)
    return img

# --- icons -------------------------------------------------------------------

def flame_points(cx, by, w, h):
    """A flame with three tongues, its round base centered at (cx, by)."""
    tongues = [
        (cx - w, by), (cx - w * 1.05, by - h * 0.35), (cx - w * 0.55, by - h * 0.62),
        (cx - w * 0.6, by - h * 0.35), (cx - w * 0.15, by - h * 0.78), (cx, by - h),
        (cx + w * 0.3, by - h * 0.6), (cx + w * 0.55, by - h * 0.8), (cx + w * 0.75, by - h * 0.35),
        (cx + w * 1.05, by - h * 0.42), (cx + w, by),
    ]
    bottom = [(cx + math.cos(a) * w, by + math.sin(a) * w * 0.85) for a in [math.pi * i / 20 for i in range(1, 20)]]
    return tongues + bottom

def flame_mask(cx, by, w, h, k=1.0):
    m, d = mask()
    d.polygon([(cx + (x - cx) * k, by + (y - by) * k + (1 - k) * w * 0.4) for x, y in flame_points(cx, by, w, h)], fill=255)
    return m

def face(img, cx, cy, grin=False):
    """Bomb-style face: two tall eyes with a shine and a small smile."""
    d = ImageDraw.Draw(img)
    for ex in (cx - 4, cx + 3):
        d.rectangle([ex, cy - 2, ex + 1, cy + 2], fill=INK)
        d.point([(ex, cy - 2)], fill=WHITE)
    if grin:
        d.chord([cx - 4, cy + 1, cx + 4, cy + 7], 0, 180, fill=INK)
        d.rectangle([cx - 2, cy + 5, cx + 1, cy + 6], fill=(255, 110, 110, 255))
    else:
        d.arc([cx - 3, cy + 1, cx + 3, cy + 5], 20, 160, fill=INK)

def fire_icon(cx, by, w, h, grin):
    img = outline(layers(
        volume(flame_mask(cx, by, w, h), (240, 70, 30), R=6),
        volume(flame_mask(cx, by, w, h, 0.72), (255, 150, 30), R=3, gloss=False),
        volume(flame_mask(cx, by, w, h, 0.45), (255, 225, 90), R=3, levels=(1.0, 1.15), gloss=False),
    ))
    face(img, cx, by - 2, grin)
    return img

def icon_fire():
    return fire_icon(24, 31, 11, 27, grin=False)

def icon_full_fire():
    img = fire_icon(24, 32, 13, 30, grin=True)
    d = ImageDraw.Draw(img)
    for sx, sy, s in [(9, 12, 3), (38, 9, 3), (40, 25, 2)]:  # sparkles
        d.polygon([(sx, sy - s - 1), (sx + 1, sy - 1), (sx + s + 1, sy), (sx + 1, sy + 1), (sx, sy + s + 1), (sx - 1, sy + 1), (sx - s - 1, sy), (sx - 1, sy - 1)], fill=WHITE)
    return img

def icon_speed():
    shoe, d = mask()
    d.polygon([(14, 15), (25, 15), (27, 23), (36, 26), (39, 31), (39, 34), (13, 34), (12, 23)], fill=255)
    sole, d2 = mask()
    d2.rounded_rectangle([11, 32, 40, 38], 2, fill=255)
    stripe, d3 = mask()
    d3.polygon([(16, 25), (25, 21), (28, 25), (18, 30)], fill=255)
    img = outline(layers(
        volume(shoe, (245, 245, 252), R=7),
        volume(stripe, (232, 60, 60), R=2, gloss=False),
        volume(sole, (210, 50, 50), R=2, gloss=False),
    ))
    d = ImageDraw.Draw(img)
    for x in (17, 21):  # laces
        d.line([(x, 17), (x + 3, 20)], fill=INK)
    for y, x0 in [(19, 3), (25, 1), (31, 4)]:  # speed lines
        d.line([(x0, y), (x0 + 6, y)], fill=WHITE, width=2)
    return img

def icon_kick():
    boot, d = mask()
    d.polygon([(13, 9), (24, 9), (24, 24), (34, 26), (39, 30), (39, 36), (13, 36)], fill=255)
    sole, d2 = mask()
    d2.rounded_rectangle([12, 34, 40, 39], 2, fill=255)
    cuff, d3 = mask()
    d3.rounded_rectangle([11, 7, 26, 12], 2, fill=255)
    img = outline(layers(
        volume(boot, (160, 96, 50), R=7),
        volume(sole, (70, 42, 24), R=2, gloss=False),
        volume(cuff, (215, 160, 95), R=2, gloss=False),
    ))
    d = ImageDraw.Draw(img)
    for y in (16, 21):  # laces
        d.line([(16, y), (21, y)], fill=(245, 228, 180, 255))
    d.arc([27, 9, 41, 23], 200, 330, fill=WHITE, width=2)  # motion
    return img

def icon_punch():
    fist, d = mask()
    d.ellipse([16, 9, 41, 36], fill=255)
    d.ellipse([12, 20, 25, 33], fill=255)  # thumb
    cuff, d2 = mask()
    d2.rounded_rectangle([6, 14, 18, 34], 3, fill=255)
    img = outline(layers(volume(cuff, (240, 240, 248), R=5, gloss=False), volume(fist, (228, 40, 40), R=10)))
    d = ImageDraw.Draw(img)
    d.arc([12, 20, 25, 33], 200, 330, fill=(140, 20, 20, 255))  # thumb crease
    for y in (19, 24, 29):  # laces
        d.line([(9, y), (14, y)], fill=(170, 170, 190, 255))
    return img

def icon_glove():
    hand, d = mask()
    d.rounded_rectangle([14, 20, 34, 37], 5, fill=255)
    for x, top in [(14, 8), (19, 5), (24, 5), (29, 8)]:
        d.rounded_rectangle([x, top, x + 4, 25], 2, fill=255)
    d.polygon([(32, 26), (38, 17), (41, 19), (36, 31)], fill=255)  # thumb
    cuff, d2 = mask()
    d2.rounded_rectangle([13, 35, 35, 41], 2, fill=255)
    img = outline(layers(volume(hand, (235, 242, 255), R=6), volume(cuff, (60, 120, 230), R=2, gloss=False)))
    d = ImageDraw.Draw(img)
    for x in (18, 23, 28):  # gaps between fingers
        d.line([(x + 1, 9), (x + 1, 22)], fill=(150, 160, 190, 255))
    return img

def icon_skull():
    head, d = mask()
    d.ellipse([10, 6, 38, 33], fill=255)
    d.rounded_rectangle([15, 25, 33, 40], 4, fill=255)
    img = outline(volume(head, (240, 236, 214), R=10))
    d = ImageDraw.Draw(img)
    d.ellipse([15, 17, 22, 25], fill=INK)
    d.ellipse([26, 17, 33, 25], fill=INK)
    d.point([(17, 19), (28, 19)], fill=(140, 255, 120, 255))  # sickly glow
    d.polygon([(24, 26), (22, 30), (26, 30)], fill=INK)
    for x in (19, 23, 27):
        d.line([(x, 34), (x, 39)], fill=INK)
    return img

def icon_egg():
    egg, d = mask()
    d.ellipse([11, 5, 37, 41], fill=255)
    spots = []
    for x, y, r in [(18, 15, 3), (29, 21, 4), (19, 30, 3), (30, 34, 2)]:
        s, ds = mask()
        ds.ellipse([x - r, y - r, x + r, y + r], fill=255)
        spots.append(volume(s, (90, 190, 80), R=2, gloss=False))
    return outline(layers(volume(egg, (255, 246, 222), R=13), *spots))

def bomb_icon(sheet, col):
    """A bomb from bombs.png (32x32 cells), trimmed and blown up to fill the plate."""
    cell = sheet.crop((col * 32, 0, col * 32 + 32, 32))
    cell = cell.crop(cell.getbbox())
    k = 36 / max(cell.size)
    cell = cell.resize((round(cell.width * k), round(cell.height * k)), Image.NEAREST)
    img = Image.new("RGBA", (N, N))
    img.alpha_composite(cell, ((N - cell.width) // 2, (N - cell.height) // 2 - 1))
    return img

def shadowed(icon):
    """Drop shadow under an icon so it stands off the plate."""
    a = icon.getchannel("A")
    sh = Image.new("RGBA", (N, N))
    sh.paste((0, 0, 0, 110), (1, 2), a)
    sh.alpha_composite(icon)
    return sh

def main():
    bombs = Image.open(sys.argv[1]).convert("RGBA")
    icons = {
        "bomb": bomb_icon(bombs, 0), "pierce": bomb_icon(bombs, 1), "remote": bomb_icon(bombs, 2),
        "fire": icon_fire(), "fullFire": icon_full_fire(), "speed": icon_speed(), "kick": icon_kick(),
        "punch": icon_punch(), "glove": icon_glove(), "skull": icon_skull(), "egg": icon_egg(),
    }
    sheet = Image.new("RGBA", (N * len(ORDER), N * FRAMES))
    for col, kind in enumerate(ORDER):
        for f in range(FRAMES):
            cell = plate(PLATES[kind], None if f == 0 else f / FRAMES)
            cell.alpha_composite(shadowed(icons[kind]))
            sheet.paste(cell, (col * N, f * N))
    sheet.save(sys.argv[2])
    if len(sys.argv) > 3:  # preview: plain row and a glint row, scaled up, on grass
        prev = Image.new("RGBA", (N * len(ORDER) + 16, N * 2 + 16), (47, 107, 58, 255))
        prev.alpha_composite(sheet.crop((0, 0, N * len(ORDER), N)), (8, 8))
        prev.alpha_composite(sheet.crop((0, 2 * N, N * len(ORDER), 3 * N)), (8, 8 + N))
        prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST).save(sys.argv[3])

main()
