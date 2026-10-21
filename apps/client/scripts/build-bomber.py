"""The bomb mascot, drawn in code (SHEETS.bomber in render/sprites.ts): a demolition trooper whose head is an iron bomb,
a visor slit glowing across it and a lit fuse on top; armor plates in the player's color over a dark suit.

He is a 3D puppet: joints in design units (y up from the ground, x = his left, z = where he faces), limbs found by
two-bone IK from where the hands and feet go, so one pose gives the front, side and back views alike. Parts are
projected, sorted back to front and filled as soft cel-shaded volumes with an ink rim (drawn 4x and scaled down).
The armor is violet (hue ~263, `hueBase` exactly), which the game repaints in each player's color; the rest is
neutral or warm and keeps its color.

Sheet rows (SHEETS.bomber): idle, walk, (front, side, back each), stun, death, cast (planting the mega bomb), carry
idle, carry walk, lobby. Frames are FW x FH units at PX px per unit.
Usage: python build-bomber.py public/sprites/bomber.png [preview.png]  (needs Pillow, numpy, scipy)"""
import math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

FW, FH = 45, 55            # frame in design units
PX, SS = 3.0, 4            # px per unit in the sheet (pixel art at the others' density), supersampling
K = PX * SS                # drawing px per unit
W, H = round(FW * K), round(FH * K)
OW, OH = W // SS, H // SS  # the frame in sheet pixels
GROUND = 53                # ground line, in units from the top of the frame
COLS = 9

INK = (22, 22, 26)
IRON = np.array([60, 62, 68.0])
SUIT = (84, 88, 98)
PANTS = (70, 74, 84)
BOOT = (44, 44, 50)
GLOVE = (52, 52, 58)
ARMOR = (106, 71, 145)     # = SHEETS.bomber.hueBase
STEEL = (128, 132, 140)
LEATHER = (112, 74, 42)
SCARF = (150, 52, 38)
BRASS = (184, 146, 72)
FUSE = (150, 108, 58)
VISOR = (255, 96, 24)
VISOR_HOT = (255, 214, 140)
SPARK = (255, 214, 63)
LIGHT = np.array([-0.5, 0.65, 0.58])  # from the top left, towards the camera (screen x, world y, depth)
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def smooth(a, b, t):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def v3(x, y, z):
    return np.array([x, y, z], float)


def rot_x(p, deg, about):
    """Pitch round the x axis (positive leans the top forward, +z)."""
    a = math.radians(deg)
    d = p - about
    y = d[1] * math.cos(a) - d[2] * math.sin(a)
    z = d[1] * math.sin(a) + d[2] * math.cos(a)
    return about + np.array([d[0], y, z])


def ik(root, target, l1, l2, pole):
    """Middle joint of a two-bone chain from `root` reaching for `target`, bending towards `pole`."""
    d = target - root
    dist = max(1e-6, min(np.linalg.norm(d), l1 + l2 - 1e-3))
    n = d / np.linalg.norm(d)
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    p = pole - n * np.dot(pole, n)
    p = p / (np.linalg.norm(p) or 1)
    return root + n * a + p * h, root + n * dist


class View:
    """Projects world points for one camera: 'front' (he faces us), 'side' (he faces right) or 'back'."""

    def __init__(self, name):
        self.name = name

    def screen(self, p):
        """World point -> (screen x, screen y, depth towards the camera), in units."""
        x, y, z = p
        sx, depth = {"front": (x, z), "side": (z, x), "back": (-x, -z)}[self.name]
        return FW / 2 + sx, GROUND - y, depth

    def toward(self):
        """The camera direction in world space."""
        return {"front": v3(0, 0, 1), "side": v3(1, 0, 0), "back": v3(0, 0, -1)}[self.name]


class Frame:
    def __init__(self):
        self.img = Image.new("RGBA", (W, H))
        self.items = []  # (depth, draw function)

    def u(self, v):
        return v * K

    def add(self, depth, fn):
        self.items.append((depth, fn))

    def render(self):
        for _, fn in sorted(self.items, key=lambda it: it[0]):
            fn()
        return pixelate(self.img)

    # --- masks -------------------------------------------------------------------------------------
    def new_mask(self):
        m = Image.new("L", (W, H))
        return m, ImageDraw.Draw(m)

    def capsule(self, d, a, b, ra, rb):
        (ax, ay), (bx, by) = a, b
        d.ellipse([self.u(ax - ra), self.u(ay - ra), self.u(ax + ra), self.u(ay + ra)], fill=255)
        d.ellipse([self.u(bx - rb), self.u(by - rb), self.u(bx + rb), self.u(by + rb)], fill=255)
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-6
        nx, ny = -dy / L, dx / L
        d.polygon([(self.u(ax + nx * ra), self.u(ay + ny * ra)), (self.u(bx + nx * rb), self.u(by + ny * rb)),
                   (self.u(bx - nx * rb), self.u(by - ny * rb)), (self.u(ax - nx * ra), self.u(ay - ny * ra))], fill=255)

    def hull(self, d, pts):
        pts = np.array(pts)
        if len(pts) < 3:
            return
        from scipy.spatial import ConvexHull
        h = ConvexHull(pts)
        d.polygon([(self.u(pts[i][0]), self.u(pts[i][1])) for i in h.vertices], fill=255)

    # --- fills ------------------------------------------------------------------------------------
    def ink(self, m, width=0.55):
        grown = m.filter(ImageFilter.MaxFilter(int(self.u(width) * 2) | 1))
        self.img.paste(Image.new("RGBA", (W, H), INK + (255,)), (0, 0), grown)

    def volume(self, m, color, radius=3.0, deep=0.55, light=1.3, gloss=0.0, rim=True):
        """Fills mask `m` as a rounded volume lit from the top left: dark core shadow, base, a lit band;
        a cool rim light on the shadow side and an optional gloss streak."""
        bb = m.getbbox()
        if not bb:
            return
        pad = int(self.u(radius)) + 2
        x0, y0, x1, y1 = max(0, bb[0] - pad), max(0, bb[1] - pad), min(W, bb[2] + pad), min(H, bb[3] + pad)
        a = np.asarray(m.crop((x0, y0, x1, y1)), float) / 255
        inside = a > 0.5
        dist = ndimage.distance_transform_edt(inside) / K
        t = np.clip(dist / radius, 0, 1)
        h = np.sqrt(1 - (1 - t) ** 2)
        gy, gx = np.gradient(h * radius * K)
        n = np.dstack([-gx, gy, np.full_like(h, K * 0.9)])
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        lam = (n * LIGHT).sum(axis=2)
        base = np.array(color, float)
        darker, lighter = base * deep, np.minimum(255, base * light + 22)
        # pixel-art shading: flat tones in hard bands, no gradients
        s1 = (lam > 0.42)[..., None]
        s2 = (lam > 0.8)[..., None]
        col = np.where(s1, base, darker)
        col = np.where(s2, lighter, col)
        if rim:  # a band of bounce light along the lower right edge
            r = ((t < 0.3) & (lam < -0.25))[..., None]
            col = np.where(r, base * 0.72, col)
        if gloss:
            g = (lam > 1.0 - 0.035 * gloss)[..., None]
            col = np.where(g, np.minimum(255, base * 0.6 + 150), col)
        out = np.zeros(a.shape + (4,), np.uint8)
        out[..., :3] = np.clip(col, 0, 255)
        out[..., 3] = np.clip(a * 255, 0, 255)
        self.img.alpha_composite(Image.fromarray(out, "RGBA"), (x0, y0))

    def part(self, draw_mask, color, ink=0.42, **kw):
        m, d = self.new_mask()
        draw_mask(d)
        self.ink(m, ink)
        self.volume(m, color, **kw)
        return m

    def glow(self, cx, cy, r, color, alpha, blur):
        g = Image.new("RGBA", (W, H))
        ImageDraw.Draw(g).ellipse([self.u(cx - r), self.u(cy - r), self.u(cx + r), self.u(cy + r)], fill=color + (alpha,))
        self.img.alpha_composite(g.filter(ImageFilter.GaussianBlur(K * blur)))


# --- the body -------------------------------------------------------------------------------------
THIGH, SHIN = 4.5, 4.4
UPPER, FORE = 4.4, 4.1
HEAD_R = 9.8


class Pose:
    """Where he is: pelvis and lean, feet and hands (world), head nod; all in units, relative to rest."""

    def __init__(self, **kw):
        self.pelvis = v3(0, 10.9, 0)
        self.lean = 4.0                   # torso pitch, degrees forward
        self.twist = 0.0
        self.foot = {1: v3(2.7, 2.0, 0.5), -1: v3(-2.7, 2.0, 0.1)}    # ankles; 1 = his left
        self.toe = {1: 0.0, -1: 0.0}      # foot pitch (degrees, + toe down)
        self.hand = {1: v3(8.4, 10.6, 0.8), -1: v3(-8.4, 10.6, 0.6)}
        self.elbow_out = {1: 0.6, -1: 0.6}
        self.fist = {1: True, -1: True}
        self.head = v3(0, 0, 0)           # offset from the neck
        self.nod = 0.0                    # head pitch, degrees forward
        self.visor = 1.0                  # glow strength (0 = dark)
        self.dizzy = False
        self.spark = 0                    # fuse spark frame
        self.flash = 0.0                  # white flash over everything
        self.wind = 0.0                   # scarf phase (cycles over a loop)
        self.drag = 0.4                   # how far the scarf streams back (0 hangs, 1 flies)
        self.fx = []                      # extra drawings over him: (depth, fn(frame, view, skeleton))
        self.hidden = False               # only the fx (he has blown up)
        self.__dict__.update(kw)


def skeleton(p):
    s = {}
    pel = p.pelvis
    s["pelvis"] = pel
    s["chest"] = rot_x(pel + v3(0, 7.6, 0), p.lean, pel)
    s["neck"] = rot_x(pel + v3(0, 10.0, 0), p.lean, pel)
    for side in (1, -1):
        hip = pel + v3(side * 2.5, -0.6, 0)
        knee, ankle = ik(hip, p.foot[side], THIGH, SHIN, v3(side * 0.15, 0, 1))
        s[("hip", side)], s[("knee", side)], s[("ankle", side)] = hip, knee, ankle
        sh = rot_x(pel + v3(side * 6.4, 8.5, -0.2), p.lean, pel)
        elbow, hand = ik(sh, p.hand[side], UPPER, FORE, v3(side * p.elbow_out[side], -0.4, -1))
        s[("shoulder", side)], s[("elbow", side)], s[("hand", side)] = sh, elbow, hand
    s["head"] = s["neck"] + v3(0, HEAD_R - 0.7, 0.5) + p.head
    return s


def ring(center, rx, rz, y, n=24, lean=0.0, about=None):
    pts = [center + v3(math.cos(a) * rx, y, math.sin(a) * rz) for a in np.linspace(0, 2 * math.pi, n, endpoint=False)]
    return [rot_x(q, lean, about) for q in pts] if about is not None else pts


def draw(pose, view_name):
    f = Frame()
    v = View(view_name)
    s = skeleton(pose)
    sc = lambda p: v.screen(p)[:2]
    depth = lambda p: v.screen(p)[2]
    cam = v.toward()

    # legs: thigh, shin, then a tall boot (shaft and foot) with a steel toe cap
    for side in (1, -1):
        hip, knee, ankle = s[("hip", side)], s[("knee", side)], s[("ankle", side)]
        dz = depth(ankle) + depth(knee)
        f.add(dz / 2 - 0.3, lambda hip=hip, knee=knee: f.part(lambda d: f.capsule(d, sc(hip), sc(knee), 2.35, 2.0), PANTS))
        f.add(dz / 2 - 0.2, lambda knee=knee, ankle=ankle: f.part(lambda d: f.capsule(d, sc(knee), sc(ankle), 1.95, 1.75), PANTS))
        toe_dir = rot_x(v3(0, 0, 1), pose.toe[side], v3(0, 0, 0))
        heel, toe = ankle + v3(0, -0.5, -0.8), ankle + v3(0, -0.7, 0) + toe_dir * 2.9
        shaft = knee + (ankle - knee) * 0.42

        def boot(heel=heel, toe=toe, ankle=ankle, shaft=shaft):
            f.part(lambda d: (f.capsule(d, sc(shaft), sc(ankle), 2.0, 2.0), f.capsule(d, sc(heel), sc(toe), 2.0, 1.75)), BOOT, gloss=0.5)
            # turned-down cuff in the armor color
            f.part(lambda d: f.capsule(d, sc(shaft + v3(0, 0.25, 0)), sc(shaft + v3(0, -0.45, 0)), 2.2, 2.2), ARMOR, radius=0.9, ink=0.32)
            if view_name != "back":
                tc = toe + (heel - toe) * 0.08
                f.part(lambda d: f.capsule(d, sc(tc), sc(tc + (heel - toe) * 0.18), 1.4, 1.4), STEEL, radius=0.8, ink=0.3, gloss=0.8)
        f.add(max(dz / 2 - 0.2, depth(ankle)) + 0.15, boot)

    # torso: rings lofted from the hips to the shoulders, a V from the chest to the waist
    lean, pel = pose.lean, s["pelvis"]
    body_rings = [(-0.6, 4.1, 2.9), (1.6, 3.7, 2.7), (4.0, 4.9, 3.1), (6.4, 6.0, 3.4), (8.3, 6.2, 3.3), (9.6, 4.5, 2.8)]
    torso_pts = [sc(q) for y, rx, rz in body_rings for q in ring(pel, rx, rz, y, lean=lean, about=pel)]
    f.add(0.0, lambda: f.part(lambda d: f.hull(d, torso_pts), SUIT, radius=2.6))

    # armor: a chest plate tapering to the waist (and a back plate), in the player color
    def plate_pts(zf):
        rows = [(3.6, 3.8, 3.35), (5.4, 5.2, 3.7), (7.2, 5.8, 3.75), (8.7, 5.2, 3.55)]
        pts = []
        for y, rx, rz in rows:
            for a in np.linspace(-1.15, 1.15, 9):
                q = pel + v3(math.sin(a) * rx, y, math.cos(a) * rz * zf)
                pts.append(sc(rot_x(q, lean, pel)))
        return pts

    for zf in (1, -1):
        facing = np.dot(v3(0, 0, zf), cam)
        if facing < -0.1:
            continue
        pts = plate_pts(zf)

        def plate(pts=pts, zf=zf, facing=facing):
            f.part(lambda d: f.hull(d, pts), ARMOR, radius=1.8, gloss=0.4)
            if facing > 0.5 and zf > 0:  # the emblem: a white bomb with a lit fuse
                cx, cy = sc(rot_x(pel + v3(0, 6.1, 3.9), lean, pel))
                f.part(lambda d: (d.ellipse([f.u(cx - 1.7), f.u(cy - 1.5), f.u(cx + 1.7), f.u(cy + 1.9)], fill=255),
                                  d.rectangle([f.u(cx - 0.6), f.u(cy - 2.2), f.u(cx + 0.6), f.u(cy - 1.2)], fill=255)),
                       (236, 236, 240), radius=0.7, ink=0.3, rim=False)
                dd = ImageDraw.Draw(f.img)
                dd.line([f.u(cx + 0.2), f.u(cy - 2.2), f.u(cx + 1.1), f.u(cy - 3.0)], fill=INK + (255,), width=int(K * 0.42))
                dd.rectangle([f.u(cx + 0.9), f.u(cy - 3.7), f.u(cx + 1.8), f.u(cy - 2.8)], fill=(255, 150, 40, 255))
            elif facing > 0.5:  # back plate: a vertical seam
                a, b = sc(rot_x(pel + v3(0, 8.4, -3.5), lean, pel)), sc(rot_x(pel + v3(0, 3.9, -3.2), lean, pel))
                ImageDraw.Draw(f.img).line([f.u(c) for c in a + b], fill=INK + (200,), width=int(K * 0.32))
        f.add(0.05 + 0.01 * zf, plate)

    # belt with a brass buckle
    belt_pts = [sc(q) for y in (1.3, 2.6) for q in ring(pel, 4.2, 3.05, y, lean=lean, about=pel)]

    def belt():
        f.part(lambda d: f.hull(d, belt_pts), LEATHER, radius=0.8, ink=0.36)
        if np.dot(v3(0, 0, 1), cam) > 0.25:
            x, y = sc(rot_x(pel + v3(0, 1.95, 3.1), lean, pel))
            f.part(lambda d: d.rounded_rectangle([f.u(x - 1.0), f.u(y - 0.8), f.u(x + 1.0), f.u(y + 0.8)], radius=f.u(0.25), fill=255), BRASS, radius=0.5, ink=0.3, gloss=0.6)
        if view_name == "side":  # a mini bomb hanging at his hip
            x, y = sc(rot_x(pel + v3(3.8, 0.4, 0.4), lean, pel))
            f.part(lambda d: d.ellipse([f.u(x - 1.35), f.u(y - 1.35), f.u(x + 1.35), f.u(y + 1.35)], fill=255), tuple(IRON), radius=1.1, ink=0.32, gloss=0.8)
    f.add(0.1, belt)

    # arms: shoulder pad, sleeve, glove with a cuff, fist
    for side in (1, -1):
        sh, el, ha = s[("shoulder", side)], s[("elbow", side)], s[("hand", side)]
        bias = 0.6 if view_name != "side" else 0.0
        dz = (depth(sh) + depth(el) + depth(ha)) / 3 + bias
        dz = max(dz, depth(ha) + 0.2) if view_name == "front" and ha[2] > 1.5 else dz

        def arm(sh=sh, el=el, ha=ha, side=side):
            f.part(lambda d: f.capsule(d, sc(sh), sc(el), 1.6, 1.4), SUIT)
            f.part(lambda d: f.capsule(d, sc(el), sc(ha), 1.4, 1.3), SUIT)
            a = el + (ha - el) * 0.45
            f.part(lambda d: f.capsule(d, sc(a), sc(ha), 1.55, 1.45), GLOVE, radius=0.9, gloss=0.3)
            fist = ha + (ha - el) / (np.linalg.norm(ha - el) or 1) * 0.7
            hx, hy = sc(fist)
            f.part(lambda d: d.ellipse([f.u(hx - 1.6), f.u(hy - 1.55), f.u(hx + 1.6), f.u(hy + 1.65)], fill=255), GLOVE, radius=1.0, gloss=0.4)
        f.add(dz, arm)
        pad = sh + v3(side * 0.3, 0.6, 0)
        f.add(dz + 0.05 if view_name != "side" else depth(pad) + 0.1,
              lambda pad=pad, side=side: f.part(lambda d: f.capsule(d, sc(pad + v3(-side * 0.7, 0.35, 0)), sc(pad + v3(side * 0.5, -0.5, 0)), 2.05, 1.7), ARMOR, radius=1.2, gloss=0.45))

    # scarf: wrapped round the neck, two tails streaming out behind
    nk = s["neck"]
    wrap = [sc(q) for yy in (-0.8, 0.8) for q in ring(nk, 3.3, 2.8, yy)]
    f.add(0.25, lambda: f.part(lambda d: f.hull(d, wrap), SCARF, radius=1.4))
    for k, (dx, ln, ph) in enumerate(((0.9, 9.5, 0.0), (-0.6, 7.5, 1.7))):
        pts = []
        for t in np.linspace(0, 1, 9):
            back = ln * (0.18 * t + (0.25 + 0.6 * pose.drag) * t * t)
            drop = ln * t * (1.0 - 0.55 * pose.drag)
            wave = math.sin(pose.wind + ph + t * 4.0) * t * (0.6 + 1.4 * pose.drag)
            pts.append(nk + v3(dx + wave * 0.6, -0.4 - drop + wave * 0.5 * pose.drag, -2.6 - back))
        tail_depth = sum(depth(q) for q in pts) / len(pts)
        def tail(pts=pts):
            def m(d):
                for i in range(len(pts) - 1):
                    w = 1.7 - 0.6 * i / (len(pts) - 1)
                    f.capsule(d, sc(pts[i]), sc(pts[i + 1]), w, w - 0.07)
                # frayed end
                ex, ey = sc(pts[-1])
                for j in (-1, 0, 1):
                    f.capsule(d, (ex, ey), (ex + j * 0.45 + (sc(pts[-1])[0] - sc(pts[-2])[0]) * 0.5, ey + (sc(pts[-1])[1] - sc(pts[-2])[1]) * 0.5), 0.35, 0.2)
            f.part(m, SCARF, radius=0.9, ink=0.45)
        f.add(tail_depth if view_name != "front" else -5 + k * 0.01, tail)

    # head: the iron bomb, its band, the visor slit, the cap and fuse
    hc = s["head"]
    f.add(0.4, lambda: head(f, v, pose, hc))
    for dz, fn in pose.fx:
        f.add(dz, lambda fn=fn: fn(f, v, s))
    if pose.hidden:
        f.items = [(dz, fn) for dz, fn in f.items if dz >= 50]
    return f.render() if not pose.flash else flash(f.render(), pose.flash)


def head(f, v, pose, hc):
    sc = lambda p: v.screen(p)[:2]
    cx, cy = sc(hc)
    r = HEAD_R
    m, d = f.new_mask()
    d.ellipse([f.u(cx - r), f.u(cy - r), f.u(cx + r), f.u(cy + r)], fill=255)
    f.ink(m, 0.48)
    # sphere shading: real normals, iron with a hard specular
    x0, y0, x1, y1 = [int(f.u(c)) for c in (cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1)]
    ys, xs = np.mgrid[y0:y1, x0:x1]
    nx = ((xs + 0.5) / K - cx) / r
    ny = -((ys + 0.5) / K - cy) / r
    r2 = nx * nx + ny * ny
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    tones = [IRON * 0.42, IRON * 0.72, IRON, IRON * 1.45 + 12, IRON * 2.2 + 40]
    col = np.where((lam < 0.05)[..., None], tones[0], np.where((lam < 0.38)[..., None], tones[1],
          np.where((lam < 0.72)[..., None], tones[2], np.where((lam < 0.9)[..., None], tones[3], tones[4]))))
    refl = 2 * lam[..., None] * np.dstack([nx, ny, nz]) - LIGHT
    spec = np.clip(refl[..., 2], 0, 1) ** 18
    col = np.where((spec > 0.55)[..., None], np.array([226, 230, 238.0]), col)
    # cast iron: a few scratches
    sr = random.Random(5)
    scratch = Image.new("L", (x1 - x0, y1 - y0))
    sdraw = ImageDraw.Draw(scratch)
    for _ in range(9):
        a, d0 = sr.uniform(0, math.pi), sr.uniform(0.15, 0.8)
        b = sr.uniform(0, 2 * math.pi)
        px_, py_ = (r + 1 + math.cos(b) * d0 * r) * K, (r + 1 + math.sin(b) * d0 * r) * K
        L = sr.uniform(0.8, 2.2) * K
        sdraw.line([px_ - math.cos(a) * L, py_ - math.sin(a) * L, px_ + math.cos(a) * L, py_ + math.sin(a) * L], fill=sr.randint(60, 120), width=max(1, int(K * 0.14)))
    sc_ = np.asarray(scratch, float)[..., None] / 255
    col = np.where(sc_ > 0.3, np.minimum(255, col * 1.6 + 18), col)
    rimlight = (np.sqrt(r2) > 0.86) & (nx + ny * 0.3 < -0.35)
    col = np.where(rimlight[..., None], np.array([92, 100, 118.0]), col)
    out = np.zeros(nx.shape + (4,), np.uint8)
    out[..., :3] = np.clip(col, 0, 255)
    out[..., 3] = (r2 <= 1) * 255
    f.img.alpha_composite(Image.fromarray(out, "RGBA"), (x0, y0))

    cam = v.toward()
    tilt = pose.nod
    def on_head(dirv):
        return hc + rot_x(dirv, tilt, v3(0, 0, 0)) * r

    dd = ImageDraw.Draw(f.img)
    # the steel band round the eyes, with rivets
    band_y = -0.05
    angs = np.linspace(0, 2 * math.pi, 120, endpoint=False)
    def band_pts(y, scale=1.0):
        rr = math.sqrt(1 - y * y) * scale
        return [(a, on_head(v3(math.sin(a) * rr, y, math.cos(a) * rr))) for a in angs]
    top, bot = band_pts(band_y + 0.17, 1.03), band_pts(band_y - 0.17, 1.03)
    band = Image.new("L", (W, H))
    bd = ImageDraw.Draw(band)
    for i in range(len(angs)):
        j = (i + 1) % len(angs)
        quad = [top[i][1], top[j][1], bot[j][1], bot[i][1]]
        if min(np.dot((q - hc), cam) for q in quad) < -0.2:
            continue
        bd.polygon([(f.u(sc(q)[0]), f.u(sc(q)[1])) for q in quad], fill=255)
    clip = Image.new("L", (W, H))
    clip.paste(band, (0, 0), m)
    bandimg = Image.new("RGBA", (W, H))
    bandimg.paste(Image.new("RGBA", (W, H), INK + (255,)), (0, 0), clip.filter(ImageFilter.MaxFilter(int(K * 0.5) | 1)))
    f.img.alpha_composite(bandimg)
    f.volume(clip, STEEL, radius=0.7, gloss=0.6, rim=False)
    # rivets
    for a in np.linspace(0, 2 * math.pi, 14, endpoint=False):
        if abs((a + math.pi) % (2 * math.pi) - math.pi) < 0.75:
            continue  # the visor
        p = on_head(v3(math.sin(a) * 1.03, band_y, math.cos(a) * 1.03))
        if np.dot(p - hc, cam) < 0.25 * r:
            continue
        x, y = sc(p)
        dd.ellipse([f.u(x - 0.38), f.u(y - 0.38), f.u(x + 0.38), f.u(y + 0.38)], fill=(70, 72, 80, 255))
        dd.ellipse([f.u(x - 0.22), f.u(y - 0.3), f.u(x + 0.1), f.u(y - 0.02)], fill=(210, 214, 222, 255))

    # visor: a narrow slit across the front of the band, glowing
    if pose.visor > 0 or True:
        slit = Image.new("L", (W, H))
        sd = ImageDraw.Draw(slit)
        sclip = Image.new("L", (W, H))
        for sgn in (-1, 1):
            span = np.linspace(0.07, 0.6, 24) * sgn
            top_y = lambda a: band_y + 0.015 + 0.13 * (abs(a) - 0.07) / 0.53
            upper = [on_head(v3(math.sin(a) * 1.05, top_y(a), math.cos(a) * 1.05)) for a in span]
            lower = [on_head(v3(math.sin(a) * 1.05, top_y(a) - 0.13 - 0.04 * (0.6 - abs(a)), math.cos(a) * 1.05)) for a in span]
            vis = [np.dot(q - hc, cam) > 0.05 * r for q in upper]
            poly = [sc(q) for q, ok in zip(upper, vis) if ok] + [sc(q) for q, ok in list(zip(lower, vis))[::-1] if ok]
            if len(poly) > 3:
                sd.polygon([(f.u(x), f.u(y)) for x, y in poly], fill=255)
        sclip.paste(slit, (0, 0), m)
        if sclip.getbbox():
            dark = Image.new("RGBA", (W, H), (12, 8, 6, 255))
            f.img.paste(dark, (0, 0), sclip.filter(ImageFilter.MaxFilter(int(K * 0.3) | 1)))
            g = pose.visor
            if g > 0:
                hot = Image.new("RGBA", (W, H), tuple(int(c * g + 30 * (1 - g)) for c in VISOR) + (255,))
                f.img.paste(hot, (0, 0), sclip)
                core = sclip.filter(ImageFilter.MinFilter(int(K * 0.42) | 1))
                f.img.paste(Image.new("RGBA", (W, H), VISOR_HOT + (int(255 * g),)), (0, 0), core)

            poly = [(x / K, y / K) for x, y in np.argwhere(np.asarray(sclip) > 128)[::400][:, ::-1]]
            if pose.dizzy and poly:  # static flickering across the slits
                rr = random.Random(pose.spark)
                for _ in range(6):
                    x, y = poly[rr.randrange(len(poly))]
                    dd.line([f.u(x - 0.8), f.u(y), f.u(x + 0.8), f.u(y)], fill=(255, 255, 255, 220), width=int(K * 0.25))

    # cap and fuse on the crown, tipped back a little
    up = rot_x(v3(0, 0.96, -0.28), tilt, v3(0, 0, 0))
    base = hc + up * r * 0.93
    capt = hc + up * (r + 0.5)
    behind = np.dot(up, cam) < -0.15
    f_pts = []
    for t in np.linspace(0, 1, 14):
        p = capt + up * (t * 4.2 - t * t * 1.2) + rot_x(v3(0, 0, -1), tilt, v3(0, 0, 0)) * (math.sin(t * math.pi * 1.1) * 1.4 + t * 2.4) + v3(t * 2.2, 0, 0)
        f_pts.append(sc(p))
    def cap():
        f.part(lambda d: f.capsule(d, sc(base), sc(capt), 3.2, 3.0), STEEL, radius=0.8, gloss=0.5, ink=0.45)
        top_x, top_y = sc(capt)
        dd.ellipse([f.u(top_x - 2.1), f.u(top_y - 0.75), f.u(top_x + 2.1), f.u(top_y + 0.75)], fill=(40, 40, 46, 255))
    def fuse():
        dd.line([(f.u(x), f.u(y)) for x, y in f_pts], fill=INK + (255,), width=int(K * 1.35), joint="curve")
        dd.line([(f.u(x), f.u(y)) for x, y in f_pts], fill=FUSE + (255,), width=int(K * 0.8), joint="curve")
        for (x, y) in f_pts[2::3]:  # braid
            dd.line([f.u(x - 0.25), f.u(y - 0.25), f.u(x + 0.25), f.u(y + 0.25)], fill=(96, 66, 34, 255), width=int(K * 0.2))
        sx, sy = f_pts[-1]
        fl = [1.0, 0.75, 1.15, 0.85][pose.spark % 4]
        dd.ellipse([f.u(sx - 1.9 * fl), f.u(sy - 1.9 * fl), f.u(sx + 1.9 * fl), f.u(sy + 1.9 * fl)], fill=(255, 140, 40, 255))
        n = 8
        rot = pose.spark * 0.7
        star = [(f.u(sx + math.cos(rot + i * math.pi / n) * (1.6 * fl if i % 2 == 0 else 0.55)),
                 f.u(sy + math.sin(rot + i * math.pi / n) * (1.6 * fl if i % 2 == 0 else 0.55))) for i in range(2 * n)]
        dd.polygon(star, fill=SPARK + (255,))
        dd.ellipse([f.u(sx - 0.45), f.u(sy - 0.45), f.u(sx + 0.45), f.u(sy + 0.45)], fill=(255, 255, 240, 255))
    if behind:
        # drawn before the head would have been nicer; the cap sits on the crown so it shows over the top edge anyway
        pass
    cap()
    fuse()


def pixelate(img):
    """Down to the sheet's pixel grid the pixel-art way: each pixel takes the most common color of its SSxSS
    block (no blending, so edges stay hard and the palette stays the drawing's own few tones)."""
    a = np.asarray(img).astype(np.uint32)
    a = a[: OH * SS, : OW * SS]
    alpha = (a[..., 3] >= 128).astype(np.uint32)
    packed = ((a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]) * alpha + alpha * (1 << 24)
    blocks = packed.reshape(OH, SS, OW, SS).transpose(0, 2, 1, 3).reshape(OH, OW, SS * SS)
    counts = (blocks[..., :, None] == blocks[..., None, :]).sum(-1)
    # ties go to the darker (outline) color, so 1-pixel ink lines survive
    lum = ((blocks >> 16) & 255) * 3 + ((blocks >> 8) & 255) * 6 + (blocks & 255)
    score = counts * 4096 - lum * (blocks >> 24) + (blocks >> 24) * 0
    best = np.take_along_axis(blocks, score.argmax(-1)[..., None], -1)[..., 0]
    out = np.zeros((OH, OW, 4), np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = (best >> 16) & 255, (best >> 8) & 255, best & 255
    out[..., 3] = ((best >> 24) & 1) * 255
    return Image.fromarray(out, "RGBA")


def flash(img, amount):
    a = np.asarray(img).astype(float)
    a[..., :3] = a[..., :3] * (1 - amount) + 255 * amount
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# --- effects -------------------------------------------------------------------------------------
def stars(phase):
    """Three little stars circling over his head (stunned)."""
    def fn(f, v, s):
        hc = s["head"]
        for i in range(3):
            a = phase + i * 2 * math.pi / 3
            p = hc + v3(math.cos(a) * 8.5, HEAD_R + 2.2, math.sin(a) * 4.0)
            x, y = v.screen(p)[:2]
            big = 1.5 + 0.35 * math.sin(a)
            pts = [(f.u(x + math.cos(j * math.pi / 4 - math.pi / 2) * (big if j % 2 == 0 else big * 0.38)),
                    f.u(y + math.sin(j * math.pi / 4 - math.pi / 2) * (big if j % 2 == 0 else big * 0.38))) for j in range(8)]
            m, d = f.new_mask()
            d.polygon(pts, fill=255)
            f.ink(m, 0.35)
            f.img.paste(Image.new("RGBA", (W, H), SPARK + (255,)), (0, 0), m)
    return fn


def blast(size, smoke, seed):
    """His end: a fireball with a ring of smoke (size 0..1), or the smoke alone drifting (smoke 0..1)."""
    def fn(f, v, s):
        rr = random.Random(seed)
        cx, cy = v.screen(s["head"] + v3(0, -6, 0))[:2]
        dd = ImageDraw.Draw(f.img)
        puffs = []
        for _ in range(16):
            a, dist = rr.uniform(0, 2 * math.pi), rr.uniform(0.25, 1.0)
            puffs.append((a, dist, rr.uniform(0.7, 1.2)))
        R = 7 + 9 * max(size, smoke)
        for a, dist, sz in sorted(puffs, key=lambda q: -q[1]):
            x, y = cx + math.cos(a) * dist * R, cy + math.sin(a) * dist * R * 0.8 - smoke * 4
            r = (3.2 + 2.2 * sz) * (0.6 + 0.6 * max(size, smoke)) * (1 - 0.45 * smoke ** 2)
            col = (118, 116, 122) if smoke else (96, 92, 98)
            f.part(lambda d, x=x, y=y, r=r: d.ellipse([f.u(x - r), f.u(y - r), f.u(x + r), f.u(y + r)], fill=255), col, radius=r * 0.9, ink=0.4)
        if size:
            for r, col in ((7.5 * size + 2, (255, 120, 30)), (5.2 * size + 1.4, (255, 196, 60)), (2.8 * size + 0.8, (255, 246, 200))):
                dd.ellipse([f.u(cx - r), f.u(cy - r * 0.9), f.u(cx + r), f.u(cy + r * 0.9)], fill=col + (255,))
            for _ in range(10):  # embers
                a, dist = rr.uniform(0, 2 * math.pi), rr.uniform(0.8, 1.3) * R
                x, y = cx + math.cos(a) * dist, cy + math.sin(a) * dist * 0.8
                dd.rectangle([f.u(x - 0.5), f.u(y - 0.5), f.u(x + 0.5), f.u(y + 0.5)], fill=rr.choice((SPARK, (255, 120, 30))) + (255,))
    return fn


# --- animations -----------------------------------------------------------------------------------
def idle(i, carry=False):
    b = math.sin(i / 4 * 2 * math.pi)
    p = Pose(spark=i, wind=i / 4 * 2 * math.pi, drag=0.25)
    p.pelvis = p.pelvis + v3(0, -0.25 * (1 - b) / 2, 0)
    p.lean = 4 + 0.8 * (1 - b) / 2
    for side in (1, -1):
        p.hand[side] = p.hand[side] + v3(0, -0.2 * (1 - b) / 2, 0)
    if carry:
        hold(p, 0.15 * b)
    return p


def hold(p, dy=0.0):
    """Hands up beside his head, holding a bomb overhead (the game draws the bomb)."""
    for side in (1, -1):
        p.hand[side] = v3(side * 7.6, 27.0 + dy, 1.2)
        p.elbow_out[side] = 1.6
    p.lean = 1.0


def walk(i, n=6, carry=False):
    ph = i / n * 2 * math.pi
    p = Pose(spark=i, wind=ph * 2, drag=0.75)
    p.lean = 9
    for side in (1, -1):
        c = math.cos(ph + (0 if side == 1 else math.pi))
        sn = math.sin(ph + (0 if side == 1 else math.pi))
        p.foot[side] = v3(side * 3.0, 2.0 + max(0.0, sn) * 2.4, 0.4 + 3.4 * c)
        p.toe[side] = -18 * max(0.0, sn)
        p.hand[side] = v3(side * 7.9, 11.2 + 0.6 * max(0, -c), 0.8 - 3.0 * c)
    p.pelvis = p.pelvis + v3(0, -0.55 * abs(math.cos(ph)) + 0.25, 0.3)
    if carry:
        hold(p, 0.3 * abs(math.sin(ph)))
        p.lean = 4
    return p


def stun(i):
    p = Pose(spark=i, dizzy=True, wind=i, drag=0.15)
    p.visor = [1.0, 0.25, 0.8, 0.15, 1.0, 0.4][i]
    w = math.sin(i / 6 * 2 * math.pi)
    p.head = v3(0.9 * w, -0.2, 0)
    p.nod = 10 + 4 * w
    p.lean = 10
    p.pelvis = p.pelvis + v3(0.4 * w, -0.9, 0)
    for side in (1, -1):
        p.foot[side] = p.foot[side] + v3(side * 0.4, 0, 0)
        p.hand[side] = v3(side * 8.6 + 0.4 * w, 9.2, 1.4)
    p.fx = [(60, stars(i * math.pi / 3))]
    return p


def death(i):
    if i <= 3:
        p = Pose(spark=i, drag=0.3, wind=i)
        p.visor = [1.0, 0.6, 0.3, 0.0][i]
        p.flash = [0.55, 0.0, 0.0, 0.0][i]
        p.lean = [-6, 10, 18, 22][i]
        p.nod = [-10, 12, 22, 26][i]
        drop = [0, 1.2, 3.6, 5.0][i]
        p.pelvis = p.pelvis + v3(0, -drop, [0, -0.6, -0.6, -0.4][i])
        for side in (1, -1):
            p.hand[side] = v3(side * [9.2, 8.4, 7.4, 6.8][i], [13, 10, 7.4, 6.0][i], [0, 1.0, 2.6, 3.4][i])
        return p
    p = Pose(hidden=True)
    p.pelvis = p.pelvis + v3(0, -5.0, 0)
    p.fx = [(60, [blast(1.0, 0, 2), blast(0.0, 0.5, 3), blast(0.0, 1.0, 4)][i - 4])]
    return p


CROUCH = [0, 0.45, 1, 1, 1, 1, 0.45, 0, 0]


def cast(i):
    """Planting the mega bomb: down on one knee, both hands pushed onto it in front, then up."""
    c = CROUCH[i]
    p = Pose(spark=i, drag=0.3, wind=i)
    p.pelvis = p.pelvis + v3(0, -4.2 * c, -0.6 * c)
    p.lean = 4 + 22 * c
    p.nod = 12 * c
    p.foot[1] = v3(3.3, 2.0, 0.5 + 1.8 * c)
    p.foot[-1] = v3(-3.3, 2.0 + 0.6 * c, 0.1 - 2.6 * c)
    p.toe[-1] = 40 * c
    for side in (1, -1):
        p.hand[side] = p.hand[side] * (1 - c) + v3(side * 3.4, 4.0, 6.4) * c
        p.elbow_out[side] = 0.6 + 0.8 * c
    return p


def mini_bomb(at, spark):
    """A small iron bomb with a lit fuse, at a world point (his lobby toss)."""
    def fn(f, v, s):
        x, y = v.screen(at)[:2]
        f.part(lambda d: d.ellipse([f.u(x - 1.9), f.u(y - 1.9), f.u(x + 1.9), f.u(y + 1.9)], fill=255), tuple(IRON), radius=1.5, ink=0.38, gloss=0.8)
        dd = ImageDraw.Draw(f.img)
        dd.rectangle([f.u(x - 0.7), f.u(y - 2.6), f.u(x + 0.7), f.u(y - 1.7)], fill=STEEL + (255,), outline=INK + (255,), width=int(K * 0.25))
        dd.line([f.u(x + 0.2), f.u(y - 2.6), f.u(x + 1.0), f.u(y - 3.5)], fill=FUSE + (255,), width=int(K * 0.4))
        r = 0.9 if spark % 2 else 0.65
        dd.rectangle([f.u(x + 1.0 - r), f.u(y - 3.6 - r), f.u(x + 1.0 + r), f.u(y - 3.6 + r)], fill=(255, 150, 40, 255))
        dd.rectangle([f.u(x + 0.75), f.u(y - 3.85), f.u(x + 1.25), f.u(y - 3.35)], fill=SPARK + (255,))
    return fn


TOSS_HAND = [12.6, 14.6, 19.0, 15.6, 15.0, 17.6, 12.4, 12.4]
TOSS_BOMB = [None, None, 30.0, 44.0, 41.0, 25.0, None, None]


def lobby(i):
    """His own move: one hand on his hip, he tosses a mini bomb up and catches it, scarf streaming."""
    p = Pose(spark=i, wind=i / 8 * 2 * math.pi, drag=0.85)
    p.visor = 1.0 if i in (3, 4) else 0.85
    p.lean = 2
    p.nod = -6 if i in (2, 3, 4) else 0  # he watches it go up
    p.foot = {1: v3(3.6, 2.0, 0.5), -1: v3(-3.4, 2.0, 0.3)}
    p.hand[1] = v3(5.9, 12.0, 1.2)  # on his hip
    p.elbow_out[1] = 2.2
    p.hand[-1] = v3(-6.4, TOSS_HAND[i], 3.4)
    p.elbow_out[-1] = 0.9
    by = TOSS_BOMB[i]
    at = v3(-6.4, by, 3.6) if by is not None else v3(-6.4, TOSS_HAND[i] + 2.4, 3.8)
    p.fx = [(60, mini_bomb(at, i))]
    return p


DIRS = ["front", "side", "back"]
ROWS = (
    [("idle", d, 4, idle) for d in DIRS]
    + [("walk", d, 6, walk) for d in DIRS]
    + [("stun", "front", 6, stun), ("death", "front", 7, death)]
    + [("cast", d, 9, cast) for d in DIRS]
    + [("carryIdle", d, 4, lambda i: idle(i, carry=True)) for d in DIRS]
    + [("carryWalk", d, 6, lambda i: walk(i, carry=True)) for d in DIRS]
    + [("lobby", "front", 8, lobby)]
)


if __name__ == "__main__":
    out = sys.argv[1]
    sheet = Image.new("RGBA", (OW * COLS, OH * len(ROWS)))
    for r, (name, view, n, make) in enumerate(ROWS):
        for i in range(n):
            sheet.alpha_composite(draw(make(i), view), (i * OW, r * OH))
        print(name, view, file=sys.stderr)
    sheet.save(out)
    print(f"sheet {sheet.size}, cell {OW}x{OH}, anchor {FW / 2 * PX} {GROUND * PX}")
    if len(sys.argv) > 2:
        prev = Image.new("RGBA", sheet.size, (47, 107, 58, 255))
        prev.alpha_composite(sheet)
        prev.save(sys.argv[2])
