"""Ninja sprite sheet (SHEETS.ninja in render/sprites.ts), drawn in HD in the bomb mascot's chibi style:
big hooded head with an eye slit and a red headband, small body, belt, arms and legs.
128x128 frames on a 32-unit grid (4 px per unit). Rows: 0-2 idle (front, side, back), 3-5 walk
(4 steps), 6 stunned, 7 death, 8-10 ice-blast cast (front, side, back; 9 frames, the thrust
on frame 5). The suit is violet (hue ~250), repainted in each player's color by hue.
The side view faces right.
Usage: python build-ninja.py public/sprites/ninja.png preview.png  (takes a few minutes)  (needs Pillow, numpy, scipy)"""
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter
from hd import Canvas, INK, WHITE

PX, COLS, ROWS = 4, 9, 11
F = 32 * PX
SUIT = (78, 64, 160, 255)
SUIT_DARK = (54, 44, 112, 255)
SKIN = (250, 214, 180, 255)
BAND = (210, 44, 44, 255)
GLOVE = (58, 58, 66, 255)
BOOT = (44, 44, 52, 255)
ICE, ICE_CORE = (127, 216, 255, 255), (235, 250, 255, 255)
YELLOW, ORANGE = (255, 214, 63, 255), (255, 122, 26, 255)


class Pose:
    """Where the limbs go in one frame. Offsets are in units from the rest pose."""

    def __init__(self, view, step=0, bob=0.0, shift=0.0, arms=None, legs=None, lean=0.0):
        self.view, self.step, self.bob, self.shift, self.lean = view, step, bob, shift, lean
        self.arms = arms  # [(hand_x, hand_y) near, far] or None for the walk default
        self.legs = legs


def limb(c, a, b, width, color, end_r, end_color):
    """An arm or leg: an inked capsule from a to b with a rounded end (hand or foot)."""
    m, d = c.mask()
    d.line(c.pts([a, b]), fill=255, width=int(c.k * width))
    for p in (a,):
        d.ellipse(c.box(p[0], p[1], width / 2, width / 2), fill=255)
    c.outline(m, 0.55)
    c.volume(m, SUIT, radius=width * 0.5, gloss=False)
    m, d = c.mask()
    d.ellipse(c.box(b[0], b[1], end_r, end_r * 0.85), fill=255)
    c.outline(m, 0.5)
    c.volume(m, end_color, radius=end_r * 0.8, gloss=False)


def foot(c, x, y, color=BOOT):
    m, d = c.mask()
    d.ellipse(c.box(x, y, 2.3, 1.4), fill=255)
    c.outline(m, 0.5)
    c.volume(m, color, radius=1.2, gloss=False)


def walk_legs(view, step):
    """(near foot, far foot) positions; feet lift on steps 1 and 3."""
    if view == "side":
        return {0: ((19.5, 29), (12.5, 29)), 1: ((16, 29), (17, 27.4)), 2: ((12.5, 29), (19.5, 29)), 3: ((17, 27.4), (16, 29))}[step]
    return {0: ((13.6, 29.3), (18.4, 28.8)), 1: ((13.6, 27.6), (18.4, 29)), 2: ((13.6, 28.8), (18.4, 29.3)), 3: ((13.6, 29), (18.4, 27.6))}[step]


def walk_arms(view, step):
    """(near hand, far hand): they swing against the legs."""
    if view == "side":
        return {0: ((13, 23.6), (20, 23.2)), 1: ((16, 24), (16.5, 24)), 2: ((20, 23.2), (13, 23.6)), 3: ((16.5, 24), (16, 24))}[step]
    return {0: ((10.4, 23.4), (21.6, 22.6)), 1: ((10.6, 23.8), (21.4, 23.8)), 2: ((10.4, 22.6), (21.6, 23.4)), 3: ((10.6, 23.8), (21.4, 23.8))}[step]


IDLE_LEGS = {"front": ((13.6, 29.2), (18.4, 29.2)), "back": ((13.6, 29.2), (18.4, 29.2)), "side": ((17.6, 29.2), (14.6, 29.2))}
IDLE_ARMS = {"front": ((10.6, 23.6), (21.4, 23.6)), "back": ((10.6, 23.6), (21.4, 23.6)), "side": ((16.4, 23.8), (15.6, 23.6))}


def head(c, view, cy, mood, frame):
    m, d = c.mask()
    d.ellipse(c.box(16, cy, 7.4, 7.0), fill=255)
    c.outline(m, 0.7)
    c.volume(m, SUIT, radius=5.5)
    # headband across the forehead, tails flowing behind
    band = Image.new("L", (c.size, c.size))
    bd = ImageDraw.Draw(band)
    bd.rectangle([c.u(8), c.u(cy - 4.6), c.u(24), c.u(cy - 2.8)], fill=255)
    clip = Image.new("L", (c.size, c.size))
    clip.paste(band, (0, 0), m)
    c.volume(clip, BAND, radius=0.8, gloss=False)
    if view != "front":
        sway = math.sin(frame * 1.6) * 0.8
        x0 = 9.0 if view == "side" else 16
        tails = [(x0, cy - 3.7), (x0 - 3, cy - 3 + sway), (x0 - 5.5, cy - 1.5 + sway)] if view == "side" else [(16, cy - 3.7), (14.5 + sway * 0.5, cy + 2), (14 + sway, cy + 5)]
        tails2 = [(x0, cy - 3.7), (x0 - 3.4, cy - 1.2 - sway), (x0 - 5, cy + 1 - sway)] if view == "side" else [(16, cy - 3.7), (17.5 - sway * 0.5, cy + 2), (18 - sway, cy + 5)]
        for t in (tails, tails2):
            c.d.line(c.pts(t), fill=INK, width=int(c.k * 1.6), joint="curve")
            c.d.line(c.pts(t), fill=BAND, width=int(c.k * 0.9), joint="curve")
        c.d.ellipse(c.box(x0, cy - 3.7, 1.1, 1.1), fill=BAND, outline=INK, width=int(c.k * 0.35))
    if view == "back":
        return
    # eye slit, clipped to the head
    slit = Image.new("L", (c.size, c.size))
    sd = ImageDraw.Draw(slit)
    if view == "front":
        sd.rounded_rectangle([c.u(10.4), c.u(cy - 2.4), c.u(21.6), c.u(cy + 1.6)], radius=c.k * 1.8, fill=255)
    else:
        sd.rounded_rectangle([c.u(15.6), c.u(cy - 2.4), c.u(24), c.u(cy + 1.6)], radius=c.k * 1.8, fill=255)
    cl = Image.new("L", (c.size, c.size))
    cl.paste(slit, (0, 0), m)
    rim = cl.filter(ImageFilter.MaxFilter(int(c.k * 0.5) | 1))
    c.img.paste(Image.new("RGBA", (c.size, c.size), SUIT_DARK), (0, 0), rim)
    c.img.paste(Image.new("RGBA", (c.size, c.size), SKIN), (0, 0), cl)
    eyes = [(13.4, cy - 0.4), (18.6, cy - 0.4)] if view == "front" else [(20.6, cy - 0.4)]
    for i, (ex, ey) in enumerate(eyes):
        if mood == "dead":
            w = int(c.k * 0.5)
            c.d.line(c.pts([(ex - 1, ey - 1), (ex + 1, ey + 1)]), fill=INK, width=w)
            c.d.line(c.pts([(ex + 1, ey - 1), (ex - 1, ey + 1)]), fill=INK, width=w)
        elif mood == "dizzy":
            pts = [(ex + math.cos(t + frame) * t * 0.13, ey + math.sin(t + frame) * t * 0.13) for t in [j * 0.3 for j in range(40)]]
            c.d.line(c.pts(pts), fill=INK, width=int(c.k * 0.3))
        else:
            look = 0.35 if view == "side" else (0.2 if i == 0 else -0.2)
            c.d.ellipse(c.box(ex + look, ey, 1.05, 1.45), fill=INK)
            c.d.ellipse(c.box(ex + look + 0.35, ey - 0.55, 0.38, 0.38), fill=WHITE)
            # determined brows
            if view == "front":
                inner = 1 if i == 0 else -1
                c.d.line(c.pts([(ex - 1.4 * inner, ey - 2.2), (ex + 1.2 * inner, ey - 1.5)]), fill=INK, width=int(c.k * 0.5))
            else:
                c.d.line(c.pts([(ex - 1.2, ey - 2.1), (ex + 1.3, ey - 1.5)]), fill=INK, width=int(c.k * 0.5))


def body(c, cy, view):
    m, d = c.mask()
    d.rounded_rectangle([c.u(16 - 4.2), c.u(cy - 3.6), c.u(16 + 4.2), c.u(cy + 3.6)], radius=c.k * 3, fill=255)
    c.outline(m, 0.6)
    c.volume(m, SUIT, radius=3.0, gloss=False)
    belt = Image.new("L", (c.size, c.size))
    ImageDraw.Draw(belt).rectangle([c.u(10), c.u(cy + 0.6), c.u(22), c.u(cy + 1.9)], fill=255)
    clip = Image.new("L", (c.size, c.size))
    clip.paste(belt, (0, 0), m)
    c.volume(clip, BAND, radius=0.6, gloss=False)
    if view == "front":
        c.d.rectangle([c.u(15.2), c.u(cy + 0.4), c.u(16.8), c.u(cy + 2.2)], fill=(150, 26, 26, 255))


def ninja(pose, mood="happy", frame=0, flash=False, orb=None):
    """One frame. `orb`: (x, y, r) of the ice ball being formed, drawn between the hands."""
    c = Canvas(32, PX)
    v, s = pose.view, pose.shift
    hip = 24.6 + pose.bob
    legs = pose.legs or walk_legs(v, pose.step)
    arms = pose.arms or walk_arms(v, pose.step)
    # far limbs first (behind the body)
    near_leg, far_leg = legs
    near_arm, far_arm = arms
    hip_far = (16 + s + (0 if v == "side" else 2.2), hip)
    hip_near = (16 + s - (0 if v == "side" else 2.2), hip)
    sh_far = (16 + s + (0.5 if v == "side" else 3.8), 19.4 + pose.bob)
    sh_near = (16 + s - (0.5 if v == "side" else 3.8), 19.4 + pose.bob)
    if v == "side":
        limb(c, sh_far, (far_arm[0] + s, far_arm[1] + pose.bob), 2.0, SUIT, 1.25, GLOVE)
        limb(c, hip_far, (far_leg[0] + s, far_leg[1] - 0.6), 2.4, SUIT, 0.1, SUIT)
        foot(c, far_leg[0] + s + 0.6, far_leg[1], BOOT)
    else:
        limb(c, hip_far, (far_leg[0] + s, far_leg[1] - 0.6), 2.4, SUIT, 0.1, SUIT)
        foot(c, far_leg[0] + s, far_leg[1])
        limb(c, hip_near, (near_leg[0] + s, near_leg[1] - 0.6), 2.4, SUIT, 0.1, SUIT)
        foot(c, near_leg[0] + s, near_leg[1])
    body(c, 21.4 + pose.bob, v)
    if v == "side":
        limb(c, hip_near, (near_leg[0] + s, near_leg[1] - 0.6), 2.4, SUIT, 0.1, SUIT)
        foot(c, near_leg[0] + s + 0.6, near_leg[1])
    if orb and v == "back":
        draw_orb(c, *orb)
    if v != "side":
        limb(c, sh_far, (far_arm[0] + s, far_arm[1] + pose.bob), 2.0, SUIT, 1.25, GLOVE)
    head(c, v, 11.4 + pose.bob + pose.lean, mood, frame)
    if orb and v != "back":
        draw_orb(c, *orb)
    limb(c, sh_near, (near_arm[0] + s, near_arm[1] + pose.bob), 2.0, SUIT, 1.25, GLOVE)
    img = c.done()
    if flash:  # death flash: a white silhouette
        a = img.getchannel("A")
        img = Image.new("RGBA", img.size, WHITE)
        img.putalpha(a)
    return img


def draw_orb(c, x, y, r):
    c.glow(x, y, r * 1.9, (127, 216, 255, 150), blur=r * 0.35 + 0.3)
    m, d = c.mask()
    d.ellipse(c.box(x, y, r, r), fill=255)
    c.volume(m, ICE, radius=r * 0.9, deep=0.75, light=1.3)
    c.star(x, y, r * 0.8, r * 0.25, ICE_CORE, points=4)


def stunned(frame):
    img = ninja(Pose("front", 0, shift=[-0.8, 0, 0.8, 0][frame]), "dizzy", frame)
    c = Canvas(32, PX)
    for i in range(3):
        a = frame * math.pi / 2 + i * 2 * math.pi / 3
        c.star(16 + math.cos(a) * 8.5, 3.6 + math.sin(a) * 2.2, 1.5, 0.6, YELLOW, ORANGE)
    img.alpha_composite(c.done())
    return img


def smoke(radius, density, seed):
    r = random.Random(seed)
    c = Canvas(32, PX)
    for _ in range(int(26 * density)):
        a, dist = r.uniform(0, 2 * math.pi), r.uniform(0, radius)
        x, y = 16 + math.cos(a) * dist, 18 + math.sin(a) * dist * 0.8
        s = r.uniform(1.6, 3.4) * (0.6 + density * 0.5)
        g = int(120 + dist / radius * 90)
        c.d.ellipse(c.box(x, y, s, s), fill=(g, g, g + 10, int(200 * min(1, density + 0.3))))
    for _ in range(int(8 * density)):  # leaves: a ninja vanishes in a puff
        a, dist = r.uniform(0, 2 * math.pi), r.uniform(radius * 0.5, radius * 1.2)
        x, y = 16 + math.cos(a) * dist, 18 + math.sin(a) * dist
        c.d.ellipse(c.box(x, y, 0.9, 0.5), fill=(90, 170, 70, 230))
    c.img = c.img.filter(ImageFilter.GaussianBlur(c.k * 0.12))
    return c.done()


def cast(view, f):
    """Ice blast, 9 frames: gather (0-4, the orb grows at the chest), thrust (5-6), recover (7-8)."""
    grow = [0.6, 1.0, 1.4, 1.8, 2.2, 0, 0, 0, 0][f]
    if view == "side":
        if f <= 4:
            arms = ((13.5, 21.2), (14.5, 20.6))
            orb = (12.0, 20.6, grow)
            lean = 0.4
        elif f <= 6:
            arms = ((24.5, 20.6), (23.6, 20))
            orb = None
            lean = -0.4
        else:
            arms = walk_arms("side", 0)
            orb, lean = None, 0
    elif view == "front":
        if f <= 4:
            arms = ((13.2, 21.4), (18.8, 21.4))
            orb = (16, 21.6, grow)
            lean = 0.3
        elif f <= 6:
            arms = ((12.6, 25.6), (19.4, 25.6))
            orb = None
            lean = 0.6
        else:
            arms = walk_arms("front", 1)
            orb, lean = None, 0
    else:
        if f <= 4:
            arms = ((12.2, 17.5), (19.8, 17.5))
            orb = (16, 15.0, grow)
            lean = -0.2
        elif f <= 6:
            arms = ((12.6, 15.2), (19.4, 15.2))
            orb = None
            lean = -0.6
        else:
            arms = walk_arms("back", 1)
            orb, lean = None, 0
    img = ninja(Pose(view, 0, arms=arms, lean=lean), frame=f, orb=orb if orb and orb[2] > 0 else None)
    if f in (5, 6):  # burst of ice where the hands push
        c = Canvas(32, PX)
        hx, hy = (25.5, 20.4) if view == "side" else (16, 26.6) if view == "front" else (16, 13.4)
        r = 1.6 if f == 5 else 2.4
        c.glow(hx, hy, r * 1.6, (127, 216, 255, 170), blur=0.6)
        for i in range(6):
            a = i * math.pi / 3 + f
            c.star(hx + math.cos(a) * r, hy + math.sin(a) * r, 0.9, 0.3, ICE_CORE, points=4)
        img.alpha_composite(c.done())
    return img


def main():
    sheet = Image.new("RGBA", (F * COLS, F * ROWS))
    put = lambda img, col, row: sheet.alpha_composite(img, (col * F, row * F))
    for r, view in enumerate(["front", "side", "back"]):
        for col, bob in enumerate([0, 0, 0.35, 0.35]):  # idle: breathing, feet together
            put(ninja(Pose(view, 0, bob=bob, legs=IDLE_LEGS[view], arms=IDLE_ARMS[view]), frame=col), col, r)
        for col in range(4):
            put(ninja(Pose(view, col, bob=-0.8 if col % 2 else 0), frame=col), col, r + 3)
        for col in range(9):
            put(cast(view, col), col, r + 8)
    for col in range(4):
        put(stunned(col), col, 6)
    death = [
        ninja(Pose("front", 0), "dead", flash=True),
        ninja(Pose("front", 0, bob=0.6), "dead", 1),
        ninja(Pose("front", 0, bob=-0.6), "dead", 2),
        smoke(9, 1.0, 1),
        smoke(11, 0.6, 2),
        smoke(12, 0.25, 3),
    ]
    for col, img in enumerate(death):
        put(img, col, 7)
    sheet.save(sys.argv[1])
    if len(sys.argv) > 2:
        prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
        prev.alpha_composite(sheet)
        prev.resize((prev.width // 2, prev.height // 2), Image.LANCZOS).save(sys.argv[2])


main()
