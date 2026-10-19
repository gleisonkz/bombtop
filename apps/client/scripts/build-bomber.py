"""Bomb mascot sprite sheet in pixel art: 32x32 frames, rows = SHEETS.bomber in render/sprites.ts:
0-2 idle (front, side, back), 3-5 walk (front, side, back), 6 stunned, 7 death.
The body is painted in BODY (base, shade, deep, light), which the game repaints in each
player's color; outline, face, feet, cap and fuse keep their colors. The side view faces right.
Usage: python build-bomber.py public/sprites/bomber.png preview.png  (needs Pillow)"""
import math, sys
from PIL import Image

N, COLS, ROWS = 32, 6, 8
OUT = (20, 20, 32, 255)
BASE, SHADE, DEEP, LIGHT = (64, 64, 128, 255), (46, 46, 98, 255), (32, 32, 70, 255), (112, 112, 184, 255)
SHINE = (228, 232, 255, 255)
FOOT, FOOT_D, FOOT_FAR = (255, 176, 58, 255), (214, 124, 30, 255), (200, 120, 34, 255)
CAP, CAP_D, CAP_L = (91, 95, 115, 255), (60, 63, 80, 255), (150, 155, 175, 255)
FUSE = (150, 112, 62, 255)
YELLOW, ORANGE, WHITE = (255, 214, 63, 255), (255, 122, 26, 255), (255, 255, 255, 255)
PUPIL, MOUTH, CHEEK = (17, 17, 17, 255), (122, 31, 43, 255), (255, 128, 166, 255)
SMOKE = [(120, 120, 132, 255), (160, 160, 172, 255), (200, 200, 210, 255)]
LIGHT_DIR = (-0.5, -0.65, 0.58)

class Frame:
    def __init__(self):
        self.img = Image.new("RGBA", (N, N))
        self.px = self.img.load()

    def put(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.px[int(x), int(y)] = c

    def get(self, x, y):
        return self.px[x, y] if 0 <= x < N and 0 <= y < N else (0, 0, 0, 0)

    def outline(self, mask):
        """Ink around a set of pixels (where nothing is drawn yet)."""
        for (x, y) in list(mask):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in mask and self.get(*q)[3] == 0:
                    self.put(*q, OUT)

def ellipse(cx, cy, rx, ry):
    return {(x, y) for y in range(N) for x in range(N) if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1}

def shaded_body(f, cx, cy, rx, ry, flash=False):
    """The round body lit from the top left in four tones, with a shine spot."""
    ln = math.sqrt(sum(v * v for v in LIGHT_DIR))
    L = [v / ln for v in LIGHT_DIR]
    pts = ellipse(cx, cy, rx, ry)
    for (x, y) in pts:
        nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
        nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
        lam = nx * L[0] + ny * L[1] + nz * L[2]
        c = LIGHT if lam > 0.88 else BASE if lam > 0.52 else SHADE if lam > 0.22 else DEEP
        f.put(x, y, WHITE if flash else c)
    if not flash:
        sx, sy = int(cx - rx * 0.62), int(cy - ry * 0.7)
        for x, y in ((sx, sy), (sx + 1, sy), (sx, sy + 1)):
            f.put(x, y, SHINE)
    f.outline(pts)
    return pts

def foot(f, cx, y, color=FOOT):
    pts = ellipse(cx, y, 3.2, 1.8)
    for (x, yy) in pts:
        f.put(x, yy, color if yy < y else FOOT_D if color == FOOT else color)
    f.outline(pts)

def cap_and_fuse(f, top, mirror, frame):
    """Gray cap on the top right (left when seen from behind), a fuse and a flickering spark."""
    m = (lambda x: 31 - x) if mirror else (lambda x: x)
    cap = {(x, y) for x in range(19, 23) for y in range(top - 3, top + 1)}
    for (x, y) in cap:
        f.put(m(x), y, CAP_L if y == top - 3 else CAP_D if x == 22 else CAP)
    f.outline({(m(x), y) for (x, y) in cap})
    for x, y in ((21, top - 4), (22, top - 5), (23, top - 6), (24, top - 6)):
        f.put(m(x), y, FUSE)
    sx, sy = 26, top - 7
    if frame % 2 == 0:
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            f.put(m(sx + dx), sy + dy, YELLOW)
        f.put(m(sx), sy, WHITE)
    else:
        for dx, dy in ((0, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            f.put(m(sx + dx), sy + dy, ORANGE)
        f.put(m(sx), sy, YELLOW)

def eye(f, x, y, pupil_x, w=4):
    """A rounded white eye (w x 5, corners cut) with a 2x3 pupil starting at column `pupil_x`."""
    for dx in range(w):
        for dy in range(5):
            if (dx in (0, w - 1)) and dy in (0, 4):
                continue
            f.put(x + dx, y + dy, WHITE)
    for dx in range(2):
        for dy in range(1, 4):
            f.put(pupil_x + dx, y + dy, PUPIL)

def x_eye(f, x, y):
    for d in range(3):
        f.put(x + d, y + d, PUPIL)
        f.put(x + 2 - d, y + d, PUPIL)

def dizzy_eye(f, x, y):
    for dx, dy in ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 2), (0, 2), (0, 1)):
        f.put(x + dx, y + dy, WHITE)
    f.put(x + 1, y + 1, PUPIL)
    f.put(x + 2, y + 2, PUPIL)

def front_face(f, cy, mood="happy"):
    if mood == "dead":
        x_eye(f, 10, cy - 3)
        x_eye(f, 19, cy - 3)
    elif mood == "dizzy":
        dizzy_eye(f, 10, cy - 3)
        dizzy_eye(f, 19, cy - 3)
    else:
        eye(f, 10, cy - 4, 11)
        eye(f, 18, cy - 4, 19)
    for x in (8, 9):
        f.put(x, cy + 2, CHEEK)
    for x in (22, 23):
        f.put(x, cy + 2, CHEEK)
    if mood in ("dead", "dizzy"):
        for x, y in ((14, cy + 4), (15, cy + 3), (16, cy + 4), (17, cy + 3)):
            f.put(x, y, MOUTH)
    else:
        for x, y in ((13, cy + 3), (14, cy + 4), (15, cy + 4), (16, cy + 4), (17, cy + 4), (18, cy + 3)):
            f.put(x, y, MOUTH)
        f.put(15, cy + 5, MOUTH)
        f.put(16, cy + 5, MOUTH)

def side_face(f, cy):
    eye(f, 17, cy - 4, 19)
    for dy in range(1, 4):  # far eye peeking past the curve
        f.put(23, cy - 4 + dy, WHITE)
    f.put(24, cy - 3, PUPIL)
    f.put(24, cy - 2, PUPIL)
    f.put(19, cy + 2, CHEEK)
    f.put(20, cy + 2, CHEEK)
    for x, y in ((20, cy + 4), (21, cy + 4), (22, cy + 3)):
        f.put(x, y, MOUTH)

def mascot(view, step=0, squash=0, frame=0, mood="happy", shift=0, flash=False):
    """One pose. step: 0..3 walk phase (1 and 3 lift a foot and bob the body up)."""
    f = Frame()
    lifted = step % 2 == 1
    bob = -1 if lifted else 0
    cx, cy = 16 + shift, 17 + bob + squash
    rx, ry = 9.6 + squash * 0.4, 9.6 - squash * 0.6
    if view == "side":
        # far foot first (darker), near foot after the body
        far = {0: (12, 28), 1: (17, 26), 2: (20, 28), 3: (16, 28)}[step]
        near = {0: (20, 28), 1: (16, 28), 2: (12, 28), 3: (17, 26)}[step]
        foot(f, far[0] + shift, far[1], FOOT_FAR)
    else:
        lf = {0: (11, 28), 1: (11, 26), 2: (12, 28), 3: (11, 28)}[step]
        rf = {0: (21, 28), 1: (21, 28), 2: (20, 28), 3: (21, 26)}[step]
        foot(f, lf[0] + shift, lf[1])
        foot(f, rf[0] + shift, rf[1])
    shaded_body(f, cx, cy, rx, ry, flash)
    if view == "side":
        foot(f, near[0] + shift, near[1])
    cap_and_fuse(f, int(cy - ry) + 1, view == "back", frame)
    if not flash or mood == "dead":
        if view == "front":
            front_face(f, int(cy), mood)
        elif view == "side":
            side_face(f, int(cy))
    return f.img

def stunned(frame):
    img = mascot("front", 0, 0, frame, "dizzy", shift=[-1, 0, 1, 0][frame])
    f = Frame()
    f.img = img
    f.px = img.load()
    for i in range(3):  # stars circling over the head
        a = frame * math.pi / 2 + i * 2 * math.pi / 3
        x, y = 16 + math.cos(a) * 8, 4 + math.sin(a) * 2.5
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            if f.get(int(x + dx), int(y + dy))[3] == 0:
                f.put(x + dx, y + dy, YELLOW if (dx, dy) != (0, 0) else WHITE)
    return img

def smoke(radius, density, seed):
    import random
    r = random.Random(seed)
    f = Frame()
    for _ in range(int(40 * density)):
        a, d = r.uniform(0, 2 * math.pi), r.uniform(0, radius)
        x, y = 16 + math.cos(a) * d, 18 + math.sin(a) * d * 0.8
        s = r.choice((1, 1, 2))
        c = SMOKE[min(2, int(d / radius * 3))]
        for dx in range(s):
            for dy in range(s):
                f.put(x + dx, y + dy, c)
    for _ in range(int(6 * density)):  # sparks
        a, d = r.uniform(0, 2 * math.pi), r.uniform(radius * 0.6, radius * 1.3)
        f.put(16 + math.cos(a) * d, 18 + math.sin(a) * d, r.choice((YELLOW, ORANGE)))
    return f.img

def main():
    sheet = Image.new("RGBA", (N * COLS, N * ROWS))
    def place(img, col, row):
        sheet.alpha_composite(img, (col * N, row * N))
    for r, view in enumerate(["front", "side", "back"]):
        for c, squash in enumerate([0, 0, 1, 1]):  # idle: breathing
            place(mascot(view, 0, squash, c), c, r)
        for c in range(4):  # walk
            place(mascot(view, c, 0, c), c, r + 3)
    for c in range(4):
        place(stunned(c), c, 6)
    death = [
        mascot("front", 0, 0, 0, "dead", flash=True),
        mascot("front", 0, 1, 1, "dead"),
        mascot("front", 0, -1, 0, "dead"),
        smoke(9, 1.0, 1),
        smoke(11, 0.6, 2),
        smoke(12, 0.25, 3),
    ]
    for c, img in enumerate(death):
        place(img, c, 7)
    sheet.save(sys.argv[1])
    if len(sys.argv) > 2:
        prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
        prev.alpha_composite(sheet)
        prev.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(sys.argv[2])

main()
