"""Builds the ninja's ice cast frames: the PixelLab skeleton cast (castcustom/<dir>/0..7.png, posed
from our own skeletons: both hands gather at one side, then thrust forward) with our ice drawn over it,
a frost orb growing between the hands, then a burst of shards as the palms thrust.
Writes castice/<dir>/0..8.png (9 frames x CAST_TICKS_PER_FRAME = BLAST_TICKS; the thrust lands on
frame 5 = BEAM_DELAY, when the beam shows).
Usage: python build-ninja-cast.py FRAMES_DIR"""
import math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

# output column -> generated frame
SOURCE = [0, 1, 2, 2, 2, 3, 4, 5, 6]
# where the hands meet in each generated frame (128px canvas), from the skeletons we posed
HANDS = {
    "south": {1: (48, 82), 2: (46, 79), 3: (64, 93), 4: (64, 94), 5: (64, 94)},
    "east": {1: (49, 84), 2: (47, 84), 3: (99, 79), 4: (100, 79), 5: (100, 79)},
    "north": {1: (82, 80), 2: (84, 78), 3: (64, 66), 4: (64, 65), 5: (64, 65)},
}
FORWARD = {"south": (0, 1), "east": (1, 0), "north": (0, -1)}
# per column: frost orb radius, burst radius, shard reach (0 = none)
LOOK = [(0, 0, 0), (4, 0, 0), (6, 0, 0), (7.5, 0, 0), (9, 0, 0), (0, 18, 14), (0, 13, 22), (0, 7, 28), (0, 0, 0)]

DEEP = (31, 76, 168)
ICE = (79, 223, 255)
PALE = (200, 246, 255)
WHITE = (255, 255, 255)


def glow(size, cx, cy, r, color, strength=1.0):
    """Soft round light, brightest in the middle."""
    y, x = np.mgrid[0:size, 0:size]
    d = np.hypot(x + 0.5 - cx, y + 0.5 - cy) / max(r, 0.1)
    a = np.clip(1 - d, 0, 1) ** 1.6 * strength
    out = np.zeros((size, size, 4), np.uint8)
    out[..., :3] = color
    out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def orb(size, cx, cy, r, t):
    """Frost orb: halo, faceted crystal core, a twinkle that turns with `t`."""
    im = glow(size, cx, cy, r * 2.4, ICE, 0.9)
    im.alpha_composite(glow(size, cx, cy, r * 1.4, WHITE, 0.6))
    d = ImageDraw.Draw(im)
    pts = [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in (math.pi / 4 * k + t * 0.6 for k in range(8))]
    d.polygon(pts, fill=PALE + (255,), outline=DEEP + (255,))
    d.polygon([(cx - r * 0.55, cy - r * 0.15), (cx - r * 0.1, cy - r * 0.6), (cx + r * 0.2, cy - r * 0.1), (cx - r * 0.2, cy + r * 0.25)], fill=WHITE + (255,))
    s = r * 0.9 + 1.5
    a = t * 0.9
    for k in range(2):
        ang = a + k * math.pi / 2
        dx, dy = math.cos(ang) * s, math.sin(ang) * s
        d.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=WHITE + (240,), width=2)
    return im


def shard(d, x, y, dx, dy, length, width):
    """A thin ice crystal pointing along (dx, dy)."""
    px, py = -dy, dx
    tip = (x + dx * length, y + dy * length)
    back = (x - dx * length * 0.35, y - dy * length * 0.35)
    pts = [tip, (x + px * width, y + py * width), back, (x - px * width, y - py * width)]
    d.polygon(pts, fill=ICE + (255,), outline=DEEP + (255,))
    d.line([back, tip], fill=PALE + (255,), width=1)


def burst(size, cx, cy, r, reach, fwd):
    """Flash at the palms with shards fanning out forward."""
    im = glow(size, cx, cy, r * 1.8, PALE, 0.9) if r else Image.new("RGBA", (size, size))
    if r:
        im.alpha_composite(glow(size, cx, cy, r * 0.8, WHITE, 1.0))
    d = ImageDraw.Draw(im)
    fx, fy = fwd
    base = math.atan2(fy, fx)
    for k, spread in enumerate((-0.75, -0.35, 0, 0.35, 0.75)):
        ang = base + spread
        dx, dy = math.cos(ang), math.sin(ang)
        dist = reach * (1.0 if k == 2 else 0.75)
        if dist <= 0:
            continue
        length = 9 if k == 2 else 6
        shard(d, cx + dx * dist, cy + dy * dist, dx, dy, length, 2.6 if k == 2 else 2)
    return im


def main():
    src = Path(sys.argv[1])
    for direction, hands in HANDS.items():
        out = src / "castice" / direction
        out.mkdir(parents=True, exist_ok=True)
        for col, frame in enumerate(SOURCE):
            body = Image.open(src / "castcustom" / direction / f"{frame}.png").convert("RGBA")
            size = body.width
            orb_r, burst_r, reach = LOOK[col]
            fx = Image.new("RGBA", (size, size))
            if frame in hands and (orb_r or burst_r or reach):
                cx, cy = hands[frame]
                fx = orb(size, cx, cy, orb_r, col) if orb_r else burst(size, cx, cy, burst_r, reach, FORWARD[direction])
            im = body.copy()
            im.alpha_composite(fx)
            im.save(out / f"{col}.png")


main()
