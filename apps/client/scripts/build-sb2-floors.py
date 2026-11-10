"""SB2 arena floor art: one row of 128 px cells (public/sprites/sb2-floors.png).

Each cell stands for a floor the original arena has, redrawn in the project's style (soft shading,
dark outline, warm highlights) instead of copying the SNES tiles. Directional cells point right
(arms) or up (arrows); the renderer turns them. Rerun this script to change the art.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/sprites/sb2-floors.png"
SIZE = 128
SS = 4  # supersampling
S = SIZE * SS

CELLS = [
    "ice", "launch", "track-arm", "track-hub", "channel-arm", "channel-hub", "plate",
    "pad-1", "pad-2", "pad-3", "pad-4", "pad-5", "pause", "switch-reverse", "switch-speed",
    "arrow", "tunnel", "launcher", "trap", "trap-used", "spring",
]
OUTLINE = (34, 26, 40, 255)


def canvas():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def p(v):
    return v * SS


def shadow(img, offset=6, blur=10, alpha=90):
    a = img.split()[3].point(lambda v: min(alpha, v))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(p(blur) / 4))
    out = canvas()
    out.alpha_composite(sh, (p(offset) // 2, p(offset)))
    out.alpha_composite(img)
    return out


def disc(d, c, r, fill, outline=OUTLINE, width=3):
    d.ellipse((p(c[0] - r), p(c[1] - r), p(c[0] + r), p(c[1] + r)), fill=fill, outline=outline, width=p(width))


def font(size):
    for name in ("arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, p(size))
        except OSError:
            pass
    return ImageFont.load_default()


def ice():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, S, S), fill=(190, 235, 255, 120))
    for x0, y0, x1, y1 in ((10, 30, 52, 8), (60, 110, 118, 64), (20, 96, 44, 80)):
        d.line((p(x0), p(y0), p(x1), p(y1)), fill=(255, 255, 255, 170), width=p(4))
    d.line((p(84), p(30), p(100), p(20)), fill=(255, 255, 255, 120), width=p(3))
    return img


def launch():
    img = canvas()
    d = ImageDraw.Draw(img)
    disc(d, (64, 64), 50, (40, 70, 120, 255))
    disc(d, (64, 64), 38, (20, 34, 70, 255), outline=(120, 200, 255, 255), width=4)
    disc(d, (64, 64), 22, (8, 14, 30, 255), outline=(80, 150, 230, 255), width=3)
    d.arc((p(20), p(20), p(108), p(108)), 200, 300, fill=(220, 245, 255, 255), width=p(4))
    return shadow(img)


def arm(color, light, width):
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rectangle((p(64), p(64 - width), S, p(64 + width)), fill=OUTLINE)
    d.rectangle((p(64), p(64 - width + 4), S, p(64 + width - 4)), fill=color)
    d.line((p(64), p(64 - width + 7), S, p(64 - width + 7)), fill=light, width=p(3))
    return img


def hub(color, light, r):
    img = canvas()
    d = ImageDraw.Draw(img)
    disc(d, (64, 64), r, color)
    d.arc((p(64 - r + 6), p(64 - r + 6), p(64 + r - 6), p(64 + r - 6)), 200, 290, fill=light, width=p(3))
    return img


def plate():
    img = canvas()
    d = ImageDraw.Draw(img)
    pts = [(64, 12), (116, 64), (64, 116), (12, 64)]
    d.polygon([(p(x), p(y)) for x, y in pts], fill=(200, 40, 40, 255), outline=OUTLINE, width=p(4))
    inner = [(64, 32), (96, 64), (64, 96), (32, 64)]
    d.polygon([(p(x), p(y)) for x, y in inner], fill=(255, 205, 60, 255), outline=(120, 60, 10, 255), width=p(3))
    d.line((p(50), p(46), p(64), p(36)), fill=(255, 245, 190, 255), width=p(4))
    return shadow(img)


def pad(label, base=(70, 80, 110, 255), ring=(250, 250, 255, 255)):
    img = canvas()
    d = ImageDraw.Draw(img)
    disc(d, (64, 64), 52, base)
    disc(d, (64, 64), 40, ring, outline=(30, 30, 60, 255), width=3)
    if label:
        f = font(56)
        box = d.textbbox((0, 0), label, font=f)
        w, h = box[2] - box[0], box[3] - box[1]
        d.text((p(64) - w / 2 - box[0], p(64) - h / 2 - box[1]), label, font=f, fill=(120, 20, 150, 255))
    return shadow(img)


def pause():
    img = canvas()
    d = ImageDraw.Draw(img)
    pts = [(64, 14), (114, 64), (64, 114), (14, 64)]
    d.polygon([(p(x), p(y)) for x, y in pts], fill=(30, 30, 40, 255), outline=OUTLINE, width=p(4))
    inner = [(64, 30), (98, 64), (64, 98), (30, 64)]
    d.polygon([(p(x), p(y)) for x, y in inner], fill=(255, 220, 40, 255))
    d.rectangle((p(52), p(48), p(60), p(80)), fill=(30, 30, 40, 255))
    d.rectangle((p(68), p(48), p(76), p(80)), fill=(30, 30, 40, 255))
    return shadow(img)


def switch(kind):
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((p(14), p(14), p(114), p(114)), radius=p(18), fill=(60, 66, 78, 255), outline=OUTLINE, width=p(4))
    disc(d, (64, 64), 36, (230, 60, 50, 255) if kind == "reverse" else (60, 200, 90, 255))
    if kind == "reverse":
        d.arc((p(42), p(42), p(86), p(86)), 30, 300, fill=(255, 255, 255, 255), width=p(6))
        d.polygon([(p(86), p(56)), (p(96), p(74)), (p(76), p(72))], fill=(255, 255, 255, 255))
    else:
        for dx in (-12, 6):
            d.polygon([(p(50 + dx), p(46)), (p(68 + dx), p(64)), (p(50 + dx), p(82))], fill=(255, 255, 255, 255))
    return shadow(img)


def arrow():
    img = canvas()
    d = ImageDraw.Draw(img)
    pts = [(64, 12), (112, 62), (84, 62), (84, 114), (44, 114), (44, 62), (16, 62)]
    d.polygon([(p(x), p(y)) for x, y in pts], fill=(255, 90, 180, 255), outline=OUTLINE, width=p(5))
    d.line((p(64), p(26), p(98), p(60)), fill=(255, 200, 235, 255), width=p(4))
    return shadow(img)


def tunnel():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((p(10), p(8), p(118), p(128)), radius=p(40), fill=(70, 50, 30, 255), outline=OUTLINE, width=p(5))
    d.rounded_rectangle((p(26), p(26), p(102), p(128)), radius=p(32), fill=(10, 8, 14, 255))
    return shadow(img)


def launcher():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((p(8), p(70), p(120), p(118)), radius=p(10), fill=(90, 96, 120, 255), outline=OUTLINE, width=p(4))
    for x in (30, 64, 98):
        d.polygon([(p(x - 14), p(100)), (p(x), p(80)), (p(x + 14), p(100))], fill=(255, 210, 60, 255), outline=(110, 60, 0, 255))
    return shadow(img)


def trap(used):
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((p(10), p(10), p(118), p(118)), radius=p(10), fill=(60, 44, 30, 255) if used else (190, 150, 50, 255), outline=OUTLINE, width=p(4))
    for r in (40, 26, 12):
        d.rounded_rectangle((p(64 - r), p(64 - r), p(64 + r), p(64 + r)), radius=p(4), outline=(30, 20, 10, 255) if used else (255, 235, 140, 255), width=p(4))
    return shadow(img)


def spring():
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((p(12), p(12), p(116), p(116)), radius=p(14), fill=(40, 60, 120, 255), outline=OUTLINE, width=p(4))
    for y in (40, 56, 72, 88):
        d.line((p(34), p(y), p(94), p(y + 8)), fill=(200, 210, 230, 255), width=p(5))
    disc(d, (64, 60), 18, (90, 170, 255, 255), outline=(20, 40, 90, 255))
    d.arc((p(52), p(48), p(76), p(72)), 200, 290, fill=(230, 245, 255, 255), width=p(3))
    return shadow(img)


def build():
    art = {
        "ice": ice(),
        "launch": launch(),
        "track-arm": arm((150, 210, 255, 255), (235, 250, 255, 255), 12),
        "track-hub": hub((150, 210, 255, 255), (235, 250, 255, 255), 18),
        "channel-arm": arm((60, 40, 30, 255), (120, 90, 60, 255), 14),
        "channel-hub": hub((60, 40, 30, 255), (120, 90, 60, 255), 14),
        "plate": plate(),
        **{f"pad-{n}": pad(str(n)) for n in range(1, 6)},
        "pause": pause(),
        "switch-reverse": switch("reverse"),
        "switch-speed": switch("speed"),
        "arrow": arrow(),
        "tunnel": tunnel(),
        "launcher": launcher(),
        "trap": trap(False),
        "trap-used": trap(True),
        "spring": spring(),
    }
    sheet = Image.new("RGBA", (SIZE * len(CELLS), SIZE), (0, 0, 0, 0))
    for i, name in enumerate(CELLS):
        sheet.alpha_composite(art[name].resize((SIZE, SIZE), Image.Resampling.LANCZOS), (i * SIZE, 0))
    sheet.save(OUT)
    print(OUT, sheet.size)


if __name__ == "__main__":
    build()
