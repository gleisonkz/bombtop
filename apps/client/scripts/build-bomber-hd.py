"""Bomb mascot sprite sheet in HD: same poses and rows as build-bomber.py (SHEETS.bomberHd),
128x128 frames drawn at 4x and scaled down, so edges are smooth and shading is soft.
Designed on the same 32-unit grid as the pixel version (1 unit = 4 px here).
The body is violet (hue ~255), which the game repaints in each player's color by hue;
everything else is neutral or warm so it keeps its color.
Usage: python build-bomber-hd.py public/sprites/bomber-hd.png preview.png  (needs Pillow, numpy)"""
import math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

U = 4          # px per design unit in the final frame
SS = 4         # supersampling
F = 32 * U     # frame size
D = F * SS     # drawing size
K = U * SS     # drawing px per unit
COLS, ROWS = 6, 8

INK = (26, 26, 26, 255)
BODY_DEEP, BODY, BODY_LIGHT = np.array([40, 32, 92.0]), np.array([78, 64, 160.0]), np.array([140, 126, 220.0])
FOOT, FOOT_SHADE, FOOT_FAR = (255, 178, 60, 255), (220, 120, 28, 255), (205, 128, 40, 255)
CAP, CAP_LIGHT, CAP_DARK = (112, 112, 112, 255), (170, 170, 170, 255), (72, 72, 72, 255)
FUSE = (150, 108, 58, 255)
YELLOW, ORANGE, WHITE = (255, 214, 63, 255), (255, 122, 26, 255), (255, 255, 255, 255)
PUPIL, MOUTH, CHEEK = (20, 20, 20, 255), (130, 30, 44, 255), (255, 120, 160, 150)
LIGHT_DIR = np.array([-0.5, -0.65, 0.58])
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)

def u(v):
    return v * K

def box(cx, cy, rx, ry):
    return [u(cx - rx), u(cy - ry), u(cx + rx), u(cy + ry)]

def smooth(a, b, t):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

class Frame:
    def __init__(self):
        self.img = Image.new("RGBA", (D, D))
        self.d = ImageDraw.Draw(self.img)

    def ellipse(self, cx, cy, rx, ry, fill, outline=0.0):
        if outline:
            self.d.ellipse(box(cx, cy, rx + outline, ry + outline), fill=INK)
        self.d.ellipse(box(cx, cy, rx, ry), fill=fill)

    def layer(self, rgba):
        self.img.alpha_composite(rgba)

    def done(self):
        return self.img.resize((F, F), Image.LANCZOS)

def foot(f, cx, cy, color=FOOT):
    f.ellipse(cx, cy, 3.3, 1.9, color, 0.55)
    if color == FOOT:  # lit top, shaded sole
        f.d.chord(box(cx, cy, 3.3, 1.9), 20, 160, fill=FOOT_SHADE)
        f.d.ellipse(box(cx - 0.9, cy - 0.7, 1.2, 0.5), fill=(255, 220, 150, 255))

def body(f, cx, cy, rx, ry, flash=False):
    """Round body: ink rim, soft cel shading lit from the top left, glossy highlight."""
    f.ellipse(cx, cy, rx, ry, INK, 0.7)
    ys, xs = np.mgrid[0:D, 0:D]
    nx = ((xs + 0.5) / K - cx) / rx
    ny = ((ys + 0.5) / K - cy) / ry
    r2 = nx * nx + ny * ny
    inside = r2 <= 1
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    lam = nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1] + nz * LIGHT_DIR[2]
    a = smooth(0.12, 0.42, lam)[..., None]
    b = smooth(0.78, 0.97, lam)[..., None]
    col = BODY_DEEP * (1 - a) + BODY * a
    col = col * (1 - b) + BODY_LIGHT * b
    # bounce light along the bottom rim
    rim = (smooth(0.75, 1.0, np.sqrt(r2)) * smooth(0.2, 0.8, ny))[..., None]
    col = col * (1 - rim * 0.35) + np.array([110, 96, 190.0]) * rim * 0.35
    if flash:
        col[:] = 255
    out = np.zeros((D, D, 4), np.uint8)
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[..., 3] = inside * 255
    f.layer(Image.fromarray(out, "RGBA"))
    if not flash:  # gloss: a soft oval and a bright dot
        g = Image.new("RGBA", (D, D))
        gd = ImageDraw.Draw(g)
        gd.ellipse(box(cx - rx * 0.42, cy - ry * 0.52, rx * 0.26, ry * 0.17), fill=(255, 255, 255, 120))
        g = g.rotate(28, center=(u(cx - rx * 0.42), u(cy - ry * 0.52)), resample=Image.BICUBIC)
        g = g.filter(ImageFilter.GaussianBlur(K * 0.25))
        f.layer(g)
        f.d.ellipse(box(cx - rx * 0.55, cy - ry * 0.62, 0.55, 0.55), fill=WHITE)

def cap_and_fuse(f, top, mirror, frame):
    m = (lambda x: 32 - x) if mirror else (lambda x: x)
    # fuse: a curve from the cap to the spark
    pts = [(m(21.0 + t * 4.5), top - 3.5 - math.sin(t * math.pi * 0.8) * 2.6) for t in np.linspace(0, 1, 12)]
    f.d.line([(u(x), u(y)) for x, y in pts], fill=INK, width=int(K * 1.4), joint="curve")
    f.d.line([(u(x), u(y)) for x, y in pts], fill=FUSE, width=int(K * 0.75), joint="curve")
    # cap
    x0, x1 = sorted((m(18.6), m(23.4)))
    f.d.rounded_rectangle([u(x0 - 0.6), u(top - 3.6), u(x1 + 0.6), u(top + 1.2)], radius=K * 1.0, fill=INK)
    f.d.rounded_rectangle([u(x0), u(top - 3.0), u(x1), u(top + 0.6)], radius=K * 0.6, fill=CAP)
    f.d.rounded_rectangle([u(x0 + 0.4), u(top - 2.7), u(x1 - 0.4), u(top - 1.9)], radius=K * 0.3, fill=CAP_LIGHT)
    # spark: a star with a glow, flickering between two shapes
    sx, sy = pts[-1]
    glow = Image.new("RGBA", (D, D))
    ImageDraw.Draw(glow).ellipse(box(sx, sy, 2.6, 2.6), fill=(255, 200, 60, 110))
    f.layer(glow.filter(ImageFilter.GaussianBlur(K * 0.8)))
    rot = 0 if frame % 2 == 0 else math.pi / 5
    r_out, r_in = (2.2, 0.9) if frame % 2 == 0 else (1.8, 0.8)
    star = [(u(sx + math.cos(rot + i * math.pi / 5 - math.pi / 2) * (r_out if i % 2 == 0 else r_in)),
             u(sy + math.sin(rot + i * math.pi / 5 - math.pi / 2) * (r_out if i % 2 == 0 else r_in))) for i in range(10)]
    f.d.polygon(star, fill=YELLOW, outline=ORANGE, width=int(K * 0.3))
    f.d.ellipse(box(sx, sy, 0.6, 0.6), fill=WHITE)

def eye(f, cx, cy, look=0.0, rx=1.7, ry=2.4):
    f.ellipse(cx, cy, rx, ry, WHITE, 0.4)
    f.ellipse(cx + look, cy + 0.5, rx * 0.62, ry * 0.6, PUPIL)
    f.d.ellipse(box(cx + look + 0.35, cy - 0.15, 0.38, 0.38), fill=WHITE)

def x_eye(f, cx, cy):
    w = int(K * 0.6)
    f.d.line([u(cx - 1.4), u(cy - 1.4), u(cx + 1.4), u(cy + 1.4)], fill=INK, width=w)
    f.d.line([u(cx + 1.4), u(cy - 1.4), u(cx - 1.4), u(cy + 1.4)], fill=INK, width=w)

def dizzy_eye(f, cx, cy, frame):
    f.ellipse(cx, cy, 1.8, 2.2, WHITE, 0.4)
    pts = [(u(cx + math.cos(t + frame) * t * 0.22), u(cy + math.sin(t + frame) * t * 0.26)) for t in np.linspace(0, 4 * math.pi, 40)]
    f.d.line(pts, fill=INK, width=int(K * 0.35))

def cheeks(f, xs, cy):
    c = Image.new("RGBA", (D, D))
    cd = ImageDraw.Draw(c)
    for x in xs:
        cd.ellipse(box(x, cy + 2.6, 1.6, 0.9), fill=CHEEK)
    f.layer(c.filter(ImageFilter.GaussianBlur(K * 0.2)))

def front_face(f, cy, mood, frame):
    if mood == "dead":
        x_eye(f, 12, cy - 1.5)
        x_eye(f, 20, cy - 1.5)
    elif mood == "dizzy":
        dizzy_eye(f, 12, cy - 1.5, frame)
        dizzy_eye(f, 20, cy - 1.5, frame)
    else:
        eye(f, 12, cy - 1.5, 0.3)
        eye(f, 20, cy - 1.5, -0.3)
    cheeks(f, (8.6, 23.4), cy)
    if mood in ("dead", "dizzy"):
        pts = [(u(13.5 + i * 0.5), u(cy + 4.2 + (0.5 if i % 2 else -0.3))) for i in range(11)]
        f.d.line(pts, fill=MOUTH, width=int(K * 0.55), joint="curve")
    else:
        f.d.chord([u(13.2), u(cy + 1.6), u(18.8), u(cy + 5.8)], 0, 180, fill=INK)
        f.d.chord([u(13.7), u(cy + 2.0), u(18.3), u(cy + 5.2)], 0, 180, fill=MOUTH)
        f.d.ellipse(box(16, cy + 4.4, 1.2, 0.6), fill=(240, 110, 120, 255))  # tongue

def side_face(f, cy):
    eye(f, 19.5, cy - 1.5, 0.7)
    eye(f, 24.4, cy - 1.5, 0.4, rx=1.0, ry=2.2)  # far eye, foreshortened
    cheeks(f, (21.5,), cy)
    f.d.chord([u(20.6), u(cy + 1.8), u(25.2), u(cy + 5.4)], 0, 180, fill=INK)
    f.d.chord([u(21.0), u(cy + 2.2), u(24.8), u(cy + 4.9)], 0, 180, fill=MOUTH)

def mascot(view, step=0, squash=0, frame=0, mood="happy", shift=0.0, flash=False):
    f = Frame()
    lifted = step % 2 == 1
    cx, cy = 16 + shift, 17 + (-1 if lifted else 0) + squash * 0.8
    rx, ry = 9.8 + squash * 0.4, 9.8 - squash * 0.6
    if view == "side":
        far = {0: (12, 28.3), 1: (17, 26.5), 2: (20, 28.3), 3: (16, 28.3)}[step]
        near = {0: (20, 28.3), 1: (16, 28.3), 2: (12, 28.3), 3: (17, 26.5)}[step]
        foot(f, far[0] + shift, far[1], FOOT_FAR)
    else:
        lf = {0: (11.5, 28.3), 1: (11.5, 26.5), 2: (12.5, 28.3), 3: (11.5, 28.3)}[step]
        rf = {0: (20.5, 28.3), 1: (20.5, 28.3), 2: (19.5, 28.3), 3: (20.5, 26.5)}[step]
        foot(f, lf[0] + shift, lf[1])
        foot(f, rf[0] + shift, rf[1])
    cap_and_fuse(f, cy - ry + 1, view == "back", frame)
    body(f, cx, cy, rx, ry, flash)
    if view == "side":
        foot(f, near[0] + shift, near[1])
    if view == "front":
        front_face(f, cy, mood, frame)
    elif view == "side":
        side_face(f, cy)
    return f

def stunned(frame):
    f = mascot("front", 0, 0, frame, "dizzy", shift=[-0.8, 0, 0.8, 0][frame])
    for i in range(3):
        a = frame * math.pi / 2 + i * 2 * math.pi / 3
        x, y = 16 + math.cos(a) * 8.5, 4.2 + math.sin(a) * 2.4
        star = [(u(x + math.cos(j * math.pi / 5 - math.pi / 2) * (1.5 if j % 2 == 0 else 0.6)),
                 u(y + math.sin(j * math.pi / 5 - math.pi / 2) * (1.5 if j % 2 == 0 else 0.6))) for j in range(10)]
        f.d.polygon(star, fill=YELLOW, outline=ORANGE, width=int(K * 0.25))
    return f.done()

def smoke(radius, density, seed):
    r = random.Random(seed)
    img = Image.new("RGBA", (D, D))
    d = ImageDraw.Draw(img)
    for _ in range(int(26 * density)):
        a, dist = r.uniform(0, 2 * math.pi), r.uniform(0, radius)
        x, y = 16 + math.cos(a) * dist, 18 + math.sin(a) * dist * 0.8
        s = r.uniform(1.6, 3.4) * (0.6 + density * 0.5)
        g = int(120 + dist / radius * 90)
        d.ellipse(box(x, y, s, s), fill=(g, g, g + 10, int(200 * min(1, density + 0.3))))
    for _ in range(int(8 * density)):
        a, dist = r.uniform(0, 2 * math.pi), r.uniform(radius * 0.6, radius * 1.3)
        x, y = 16 + math.cos(a) * dist, 18 + math.sin(a) * dist
        d.ellipse(box(x, y, 0.5, 0.5), fill=r.choice((YELLOW, ORANGE)))
    return img.filter(ImageFilter.GaussianBlur(K * 0.15)).resize((F, F), Image.LANCZOS)

def main():
    sheet = Image.new("RGBA", (F * COLS, F * ROWS))
    put = lambda img, c, r: sheet.alpha_composite(img, (c * F, r * F))
    for r, view in enumerate(["front", "side", "back"]):
        for c, squash in enumerate([0, 0, 1, 1]):
            put(mascot(view, 0, squash, c).done(), c, r)
        for c in range(4):
            put(mascot(view, c, 0, c).done(), c, r + 3)
    for c in range(4):
        put(stunned(c), c, 6)
    death = [
        mascot("front", 0, 0, 0, "dead", flash=True).done(),
        mascot("front", 0, 1, 1, "dead").done(),
        mascot("front", 0, -1, 0, "dead").done(),
        smoke(9, 1.0, 1),
        smoke(11, 0.6, 2),
        smoke(12, 0.25, 3),
    ]
    for c, img in enumerate(death):
        put(img, c, 7)
    sheet.save(sys.argv[1])
    if len(sys.argv) > 2:
        prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
        prev.alpha_composite(sheet)
        prev.save(sys.argv[2])

main()
