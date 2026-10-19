"""Arena tile sheet: one row of 32x32 cells, order = TILES.cells in render/sprites.ts:
grass A (plain, flowers, pebbles), grass B (same, darker shade), block, pillar, border.
Grass noise is periodic over the cell so neighbouring tiles join seamlessly. Blocks and
walls are drawn in a 3/4 view: a lit top face over a shaded front face.
Usage: python build-tiles.py public/sprites/tiles.png preview.png  (needs Pillow)"""
import math, random, sys
from PIL import Image

N = 32

def clamp(v):
    return max(0, min(255, int(v)))

def tint(c, k):
    return (clamp(c[0] * k), clamp(c[1] * k), clamp(c[2] * k), 255)

def mix(a, b, t):
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)

# --- periodic value noise (wraps every N pixels) --------------------------------

def lattice(seed, period):
    r = random.Random(seed)
    return [[r.random() for _ in range(period)] for _ in range(period)]

def smooth(t):
    return t * t * (3 - 2 * t)

def value(grid, x, y, period):
    cell = N / period
    gx, gy = x / cell, y / cell
    x0, y0 = int(gx) % period, int(gy) % period
    x1, y1 = (x0 + 1) % period, (y0 + 1) % period
    tx, ty = smooth(gx - int(gx)), smooth(gy - int(gy))
    a = grid[y0][x0] + (grid[y0][x1] - grid[y0][x0]) * tx
    b = grid[y1][x0] + (grid[y1][x1] - grid[y1][x0]) * tx
    return a + (b - a) * ty

def fbm(seed, x, y):
    total, amp, norm = 0.0, 1.0, 0.0
    for i, period in enumerate((4, 8, 16)):
        total += value(LATTICES[(seed, period)], x, y, period) * amp
        norm += amp
        amp *= 0.5
    return total / norm

LATTICES = {(s, p): lattice(s * 31 + p, p) for s in range(8) for p in (4, 8, 16)}

# --- grass ------------------------------------------------------------------------

GRASS = [(34, 88, 44), (46, 112, 54), (60, 136, 64), (84, 162, 80), (120, 190, 98)]

def grass(shade, variant):
    """Lawn tile: mottled tones, short blades with lit tips; variant 1 adds flowers, 2 pebbles and a tuft."""
    k = 1.0 if shade == 0 else 0.86
    pal = [tint(c, k) for c in GRASS]
    img = Image.new("RGBA", (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            n = fbm(shade, x, y) * 0.75 + fbm(shade + 2, x * 2 % N, y * 2 % N) * 0.25
            i = 1 if n < 0.42 else 2 if n < 0.6 else 3 if n < 0.72 else 2
            px[x, y] = pal[i]
    r = random.Random(100 + shade * 10 + variant)
    for _ in range(26):  # blades: dark root, lit tip; wrap so edges stay seamless
        x, y = r.randrange(N), r.randrange(N)
        h = r.choice((2, 2, 3))
        lean = r.choice((-1, 0, 0, 1))
        for j in range(h):
            xx, yy = (x + (lean if j == h - 1 else 0)) % N, (y - j) % N
            px[xx, yy] = pal[0] if j == 0 else pal[4] if j == h - 1 else pal[3]
    if variant == 1:  # flowers
        for _ in range(3):
            fx, fy = r.randrange(5, N - 5), r.randrange(5, N - 5)
            petal = r.choice(((250, 250, 245), (255, 214, 80), (240, 150, 200)))
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                px[fx + dx, fy + dy] = petal + (255,)
            px[fx, fy] = (250, 180, 40, 255) if petal[1] != 214 else (200, 90, 30, 255)
            px[fx + 1, fy + 2] = pal[0]  # shadow under the flower
            px[fx, fy + 2] = pal[1]
    if variant == 2:  # pebbles and a tuft
        for _ in range(2):
            sx, sy = r.randrange(4, N - 6), r.randrange(4, N - 5)
            w = r.choice((3, 4))
            for dx in range(w):
                px[sx + dx, sy] = (150, 150, 140, 255)
                px[sx + dx, sy + 1] = (118, 118, 112, 255)
            px[sx, sy] = (196, 196, 184, 255)
            for dx in range(w):
                px[sx + dx, sy + 2] = pal[0]
        tx, ty = r.randrange(6, N - 6), r.randrange(8, N - 3)
        for dx, h in ((-2, 3), (-1, 5), (0, 6), (1, 4), (2, 3)):
            for j in range(h):
                px[tx + dx, ty - j] = pal[0] if j == 0 else pal[4] if j == h - 1 else pal[3] if j > h // 2 else pal[2]
    return img

# --- block (breakable bricks) --------------------------------------------------------

def block():
    """Breakable brick block: sandy lit top, staggered brick courses on the front, chips and cracks."""
    img = Image.new("RGBA", (N, N))
    px = img.load()
    r = random.Random(7)
    top_c, brick, mortar = (222, 160, 104), (176, 86, 50), (84, 46, 36)
    TOP = 8
    for y in range(N):
        for x in range(N):
            if y < TOP:
                n = fbm(4, x, y)
                c = tint(top_c, 0.9 + n * 0.25)
                if y == 0 or x == 0:
                    c = mix(c, (255, 236, 200), 0.5)
                if y == TOP - 1:
                    c = tint(top_c, 0.72)
                px[x, y] = c
            else:
                px[x, y] = mortar + (255,)
    # brick courses on the front face
    course = 6
    for row, y0 in enumerate(range(TOP, N, course)):
        offset = 0 if row % 2 == 0 else 8
        for bx in range(-16, N, 16):
            x0 = bx + offset
            tone = 0.88 + r.random() * 0.24
            for y in range(y0, min(N, y0 + course - 1)):
                for x in range(max(0, x0 + 1), min(N, x0 + 16)):
                    n = fbm(5, x, y)
                    c = tint(brick, tone * (0.9 + n * 0.22))
                    if y == y0:
                        c = mix(c, (255, 200, 160), 0.35)  # lit top edge of each brick
                    elif y == y0 + course - 2:
                        c = tint(c, 0.78)
                    if x == x0 + 1:
                        c = mix(c, (255, 200, 160), 0.2)
                    px[x, y] = c
    # speckle and chips
    for _ in range(18):
        x, y = r.randrange(1, N - 1), r.randrange(TOP + 1, N - 1)
        if px[x, y][:3] != mortar:
            px[x, y] = tint(px[x, y], r.choice((0.7, 1.2)))
    for cx, cy, steps in ((22, 10, 5), (6, 22, 4)):  # cracks
        x, y = cx, cy
        for _ in range(steps):
            px[x, y] = mortar + (255,)
            x += r.choice((-1, 0, 1))
            y += 1
    # outline: dark sides and bottom so neighbouring blocks read apart
    for y in range(N):
        px[N - 1, y] = tint(px[N - 1, y], 0.6)
    for x in range(N):
        px[x, N - 1] = (60, 30, 24, 255)
    return img

# --- pillar (unbreakable inner wall) ---------------------------------------------------

def pillar():
    """Stone pillar: beveled lit top with a carved inset, shaded front face below."""
    img = Image.new("RGBA", (N, N))
    px = img.load()
    stone = (138, 146, 170)
    TOP = 22
    for y in range(N):
        for x in range(N):
            n = fbm(6, x, y)
            if y < TOP:
                c = tint(stone, 0.92 + n * 0.22)
                if y <= 1 or x <= 1:
                    c = mix(c, (235, 240, 255), 0.55 if (y == 0 or x == 0) else 0.3)
                elif x >= N - 2 or y >= TOP - 2:
                    c = tint(c, 0.78 if (x == N - 2 or y == TOP - 2) else 0.66)
                # carved inset: dark groove top-left, lit edge bottom-right
                if 7 <= x <= 24 and 5 <= y <= 16:
                    if x == 7 or y == 5:
                        c = tint(stone, 0.6)
                    elif x == 24 or y == 16:
                        c = mix(tint(stone, 1.0), (235, 240, 255), 0.35)
                    else:
                        c = tint(stone, 0.86 + n * 0.16)
                px[x, y] = c
            else:
                c = tint(stone, (0.62 + n * 0.14) * (1 - (y - TOP) * 0.015))
                if x in (10, 21) and y < N - 2:
                    c = tint(c, 0.85)  # block joints on the front
                if y == TOP:
                    c = tint(stone, 0.5)
                px[x, y] = c
    for x in range(N):
        px[x, N - 1] = (34, 36, 50, 255)
    r = random.Random(3)
    for _ in range(14):  # pits
        x, y = r.randrange(3, N - 3), r.randrange(3, TOP - 3)
        if not (7 <= x <= 24 and 5 <= y <= 16):
            px[x, y] = tint(stone, 0.7)
            px[x + 1, y + 1] = mix(stone, (235, 240, 255), 0.3)
    return img

# --- border (outer wall) -----------------------------------------------------------------

def border():
    """Outer wall: big staggered stone blocks with a lit cap."""
    img = Image.new("RGBA", (N, N))
    px = img.load()
    stone, mortar = (104, 110, 136), (44, 46, 64)
    r = random.Random(11)
    for y in range(N):
        for x in range(N):
            px[x, y] = mortar + (255,)
    course = 16
    for row, y0 in enumerate(range(0, N, course)):
        offset = 0 if row % 2 == 0 else 10
        for bx in range(-20, N + 20, 20):
            x0 = bx + offset
            tone = 0.86 + r.random() * 0.24
            for y in range(y0 + 1, y0 + course):
                for x in range(max(0, x0 + 1), min(N, x0 + 20)):
                    n = fbm(7, x, y)
                    c = tint(stone, tone * (0.88 + n * 0.24))
                    if y <= y0 + 2:
                        c = mix(c, (220, 228, 255), 0.4 if y == y0 + 1 else 0.2)
                    elif x == x0 + 1:
                        c = mix(c, (220, 228, 255), 0.18)
                    elif y >= y0 + course - 2 or x >= x0 + 18:
                        c = tint(c, 0.72)
                    px[x, y] = c
    for _ in range(16):
        x, y = r.randrange(1, N - 1), r.randrange(1, N - 1)
        if px[x, y][:3] != mortar:
            px[x, y] = tint(px[x, y], r.choice((0.72, 1.18)))
    return img

def main():
    cells = [grass(0, 0), grass(0, 1), grass(0, 2), grass(1, 0), grass(1, 1), grass(1, 2), block(), pillar(), border()]
    sheet = Image.new("RGBA", (N * len(cells), N))
    for i, c in enumerate(cells):
        sheet.paste(c, (i * N, 0))
    sheet.save(sys.argv[1])
    if len(sys.argv) > 2:  # preview: a small arena corner, scaled up
        W, H = 9, 7
        prev = Image.new("RGBA", (W * N, H * N))
        for y in range(H):
            for x in range(W):
                if x == 0 or y == 0:
                    c = 8
                elif x % 2 == 0 and y % 2 == 0:
                    c = 7
                elif (x * 7 + y * 3) % 5 == 0:
                    c = 6
                else:
                    base = 0 if (x + y) % 2 == 0 else 3
                    c = base + [0, 0, 0, 1, 2][(x * 5 + y * 11) % 5]
                prev.paste(cells[c], (x * N, y * N))
                above = 8 if y == 1 else 7 if (x % 2 == 0 and (y - 1) % 2 == 0 and y > 1) else 6 if (y > 1 and (x * 7 + (y - 1) * 3) % 5 == 0) else -1
                if c < 6 and above >= 6:
                    sh = Image.new("RGBA", (N, 6), (0, 0, 0, 70))
                    prev.alpha_composite(sh, (x * N, y * N))
        prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST).save(sys.argv[2])

main()
