"""Power-up sheet: one 48x48 column per item (order = ITEMS.order in render/sprites.ts),
rows = plain, then 3 frames of a glint sweeping across the plate.
Each item is a rounded plate in its own color with an icon on top; the bomb items
reuse the real bomb sprites from bombs.png.
Usage: python build-items.py public/sprites/bombs.png public/sprites/items.png preview.png  (needs Pillow)"""
import math, sys
from PIL import Image, ImageDraw

N, FRAMES = 48, 4
INK = (21, 21, 42, 255)
WHITE = (255, 255, 255, 255)

def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)

def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)

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
    """Rounded plate with an ink outline, stepped light-to-dark bands, top shine
    and a dark lip at the bottom. `glint` (0..1 or None) puts a diagonal shine stripe."""
    img = Image.new("RGBA", (N, N))
    px = img.load()
    base = rgb(color)
    x0, y0, x1, y1, r = 2, 2, 45, 45, 9
    for y in range(N):
        for x in range(N):
            if not inside_round(x + 0.5, y + 0.5, x0, y0, x1, y1, r):
                continue
            if not inside_round(x + 0.5, y + 0.5, x0 + 2, y0 + 2, x1 - 2, y1 - 2, r - 2):
                px[x, y] = INK
                continue
            t = (y - y0) / (y1 - y0)
            band = min(3, int(t * 4))
            c = shade(base, [1.25, 1.08, 0.95, 0.8][band])
            if y >= y1 - 6:  # lip
                c = shade(base, 0.55)
            elif y <= y0 + 4:  # shine along the top
                c = mix(c, WHITE, 0.45)
            if glint is not None:
                d = (x + y) - (glint * (2 * N + 16) - 8)
                if -3 <= d <= 3:
                    c = mix(c, WHITE, 0.75 if abs(d) <= 1 else 0.4)
            px[x, y] = c
    return img

# --- icons -------------------------------------------------------------------

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

def canvas():
    img = Image.new("RGBA", (N, N))
    return img, ImageDraw.Draw(img)

def flame_shape(cx, by, w, h):
    """Points of a flame with three tongues, base centered at (cx, by)."""
    # round bottom below the base line, right to left
    bottom = [(cx + math.cos(a) * w, by + math.sin(a) * w * 0.85) for a in [math.pi * i / 20 for i in range(21)]]
    tongues = [
        (cx - w, by), (cx - w * 1.05, by - h * 0.35), (cx - w * 0.55, by - h * 0.6),
        (cx - w * 0.6, by - h * 0.35), (cx - w * 0.15, by - h * 0.75), (cx, by - h),
        (cx + w * 0.3, by - h * 0.6), (cx + w * 0.55, by - h * 0.78), (cx + w * 0.75, by - h * 0.35),
        (cx + w * 1.05, by - h * 0.4), (cx + w, by),
    ]
    return tongues + bottom[1:-1]

def flame(cx, by, w, h):
    img, d = canvas()
    layers = [((214, 52, 28, 255), 1.0), ((255, 122, 26, 255), 0.72), ((255, 210, 63, 255), 0.46), ((255, 248, 210, 255), 0.22)]
    for color, k in layers:
        d.polygon([(cx + (x - cx) * k, by + (y - by) * k + (1 - k) * w * 0.3) for x, y in flame_shape(cx, by, w, h)], fill=color)
    return img

def icon_fire():
    return outline(flame(24, 30, 10, 26))

def icon_full_fire():
    img = outline(flame(24, 31, 12, 30))
    d = ImageDraw.Draw(img)
    for sx, sy, s in [(9, 12, 3), (38, 9, 3), (40, 24, 2)]:  # sparkles
        d.polygon([(sx, sy - s - 1), (sx + 1, sy - 1), (sx + s + 1, sy), (sx + 1, sy + 1), (sx, sy + s + 1), (sx - 1, sy + 1), (sx - s - 1, sy), (sx - 1, sy - 1)], fill=WHITE)
    return img

def icon_speed():
    img, d = canvas()
    # sneaker pointing right
    d.polygon([(14, 16), (24, 16), (26, 24), (36, 27), (38, 32), (38, 35), (13, 35), (12, 24)], fill=(250, 250, 255, 255))
    d.rectangle([12, 33, 38, 36], fill=(200, 60, 60, 255))  # sole
    d.polygon([(17, 25), (25, 22), (27, 25), (18, 29)], fill=(232, 74, 74, 255))  # stripe
    d.rectangle([14, 15, 24, 17], fill=(200, 200, 215, 255))  # collar
    img = outline(img)
    d = ImageDraw.Draw(img)
    for y, x0 in [(20, 4), (26, 2), (32, 5)]:  # speed lines
        d.line([(x0, y), (x0 + 6, y)], fill=WHITE, width=2)
    return img

def icon_kick():
    img, d = canvas()
    # boot kicking right, sole and toe cap
    d.polygon([(13, 9), (23, 9), (23, 25), (34, 27), (38, 31), (38, 37), (13, 37)], fill=(140, 84, 44, 255))
    d.polygon([(30, 27), (34, 27), (38, 31), (38, 37), (30, 37)], fill=(110, 64, 32, 255))
    d.rectangle([13, 34, 38, 38], fill=(60, 36, 20, 255))
    d.rectangle([12, 9, 24, 12], fill=(190, 130, 80, 255))
    for y in (16, 21):
        d.line([(15, y), (21, y)], fill=(230, 210, 160, 255))
    img = outline(img)
    d = ImageDraw.Draw(img)
    d.arc([27, 9, 41, 23], 200, 330, fill=WHITE, width=2)  # motion
    return img

def icon_punch():
    img, d = canvas()
    # boxing glove pointing right: cuff left, fist right
    d.ellipse([16, 10, 40, 36], fill=(225, 45, 45, 255))
    d.ellipse([12, 20, 24, 32], fill=(225, 45, 45, 255))  # thumb
    d.rectangle([7, 15, 17, 33], fill=(245, 245, 250, 255))  # cuff
    d.line([(9, 17), (9, 31)], fill=(200, 200, 215, 255))
    d.ellipse([24, 13, 34, 20], fill=(255, 130, 120, 255))  # shine
    img = outline(img)
    return img

def icon_glove():
    img, d = canvas()
    w = (248, 248, 252, 255)
    # open hand, palm up-facing
    d.rounded_rectangle([14, 20, 34, 38], 5, fill=w)
    for i, (x, top) in enumerate([(14, 9), (19, 6), (24, 6), (29, 9)]):
        d.rounded_rectangle([x, top, x + 4, 24], 2, fill=w)
    d.polygon([(34, 26), (40, 18), (43, 20), (37, 31)], fill=w)  # thumb
    d.rectangle([14, 36, 34, 40], fill=(232, 74, 74, 255))  # cuff band
    for x in (19, 24, 29):
        d.line([(x - 1, 14), (x - 1, 22)], fill=(205, 205, 220, 255))
    return outline(img)

def icon_skull():
    img, d = canvas()
    bone = (236, 236, 220, 255)
    d.ellipse([11, 7, 37, 33], fill=bone)
    d.rounded_rectangle([16, 26, 32, 39], 3, fill=bone)
    d.ellipse([15, 17, 22, 25], fill=INK)
    d.ellipse([26, 17, 33, 25], fill=INK)
    d.polygon([(24, 26), (22, 30), (26, 30)], fill=INK)
    for x in (19, 23, 27):
        d.line([(x, 34), (x, 39)], fill=INK)
    d.point([(17, 19), (28, 19)], fill=(140, 255, 120, 255))  # sickly glint
    return outline(img)

def icon_egg():
    img, d = canvas()
    d.ellipse([12, 6, 36, 40], fill=(255, 248, 230, 255))
    for x, y, r in [(18, 14, 3), (28, 20, 4), (19, 28, 3), (29, 33, 2)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(108, 196, 92, 255))
    d.ellipse([16, 10, 21, 16], fill=WHITE)
    return outline(img)

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
    sh.paste((0, 0, 0, 90), (1, 2), a)
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
