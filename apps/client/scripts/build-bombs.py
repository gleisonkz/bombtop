"""Bomb sheet in HD: normal, pierce (spiked) and remote (antenna) bombs side by side,
128x128 cells on the 32-unit grid of the old pixel sheet (BOMBS in render/sprites.ts:
body centered at 16,19; fuse tip / light where BOMBS.glow says).
Usage: python build-bombs-hd.py public/sprites/bombs.png preview.png  (needs Pillow, numpy, scipy)"""
import math, sys
from PIL import Image
from hd import Canvas, INK, WHITE

PX = 4
BODY = (44, 46, 72, 255)
CAP, CAP_LIGHT = (112, 112, 116, 255), (176, 176, 180, 255)
FUSE = (150, 108, 58, 255)
SPIKE = (186, 160, 120, 255)

def body(c, r=10.2):
    m, d = c.mask()
    d.ellipse(c.box(16, 19, r, r), fill=255)
    c.outline(m, 0.7)
    c.volume(m, BODY, radius=r * 0.8, deep=0.42, light=2.4)

def face(c):
    for x in (12.6, 19.4):
        c.d.ellipse(c.box(x, 20.2, 1.15, 1.6), fill=INK)
        c.d.ellipse(c.box(x + 0.35, 19.6, 0.4, 0.4), fill=WHITE)

def cap(c, cx, top, tilt):
    m, d = c.mask()
    w, h = 2.6, 2.0
    pts = [(-w, -h), (w, -h), (w, h), (-w, h)]
    ca, sa = math.cos(tilt), math.sin(tilt)
    d.polygon(c.pts([(cx + x * ca - y * sa, top + x * sa + y * ca) for x, y in pts]), fill=255)
    c.outline(m, 0.5)
    c.volume(m, CAP, radius=1.2, gloss=False)

def fuse(c, points):
    c.d.line(c.pts(points), fill=INK, width=int(c.k * 1.3), joint="curve")
    c.d.line(c.pts(points), fill=FUSE, width=int(c.k * 0.7), joint="curve")
    x, y = points[-1]
    c.d.ellipse(c.box(x, y, 0.8, 0.8), fill=(255, 140, 40, 255))

def normal():
    c = Canvas(32, PX)
    fuse(c, [(21 + t * 4, 8.5 - math.sin(t * math.pi * 0.75) * 4.4 - t * 1.2) for t in [i / 10 for i in range(11)]])
    cap(c, 21, 9.6, 0.45)
    body(c)
    face(c)
    return c.done()

def pierce():
    c = Canvas(32, PX)
    fuse(c, [(16, 9), (16.2, 7), (16, 5)])
    for i in range(8):  # spikes all around
        a = i * math.pi / 4 + math.pi / 8
        tip = (16 + math.cos(a) * 14.2, 19 + math.sin(a) * 14.2)
        l = (16 + math.cos(a - 0.22) * 8.5, 19 + math.sin(a - 0.22) * 8.5)
        r = (16 + math.cos(a + 0.22) * 8.5, 19 + math.sin(a + 0.22) * 8.5)
        m, d = c.mask()
        d.polygon(c.pts([l, tip, r]), fill=255)
        c.outline(m, 0.5)
        c.volume(m, SPIKE, radius=0.9, gloss=False)
    body(c, 9.4)
    face(c)
    return c.done()

def remote():
    c = Canvas(32, PX)
    c.d.line(c.pts([(15.5, 10), (15.5, 4)]), fill=INK, width=int(c.k * 1.4))
    c.d.line(c.pts([(15.5, 10), (15.5, 4)]), fill=(150, 150, 156, 255), width=int(c.k * 0.7))
    m, d = c.mask()
    d.ellipse(c.box(15.5, 2.6, 1.6, 1.6), fill=255)
    c.outline(m, 0.5)
    c.volume(m, (230, 40, 40, 255), radius=1.2)
    cap(c, 15.5, 9.6, 0.0)
    body(c)
    face(c)
    return c.done()

def main():
    cells = [normal(), pierce(), remote()]
    size = 32 * PX
    sheet = Image.new("RGBA", (size * len(cells), size))
    for i, img in enumerate(cells):
        sheet.alpha_composite(img, (i * size, 0))
    sheet.save(sys.argv[1])
    if len(sys.argv) > 2:
        prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
        prev.alpha_composite(sheet)
        prev.save(sys.argv[2])

main()
