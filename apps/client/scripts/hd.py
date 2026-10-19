"""Helpers for the HD art scripts: draw on a supersampled canvas in design units, then scale down.
Shapes are flat masks given soft volume (lit from the top left) with numpy/scipy."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

INK = (26, 26, 26, 255)
WHITE = (255, 255, 255, 255)
LIGHT_DIR = np.array([-0.5, -0.65, 0.58])
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)


def smooth(a, b, t):
    t = np.clip((t - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


class Canvas:
    """A square drawing of `units` design units, `px` pixels per unit once scaled down by `ss`."""

    def __init__(self, units, px, ss=4):
        self.units, self.px, self.ss = units, px, ss
        self.k = px * ss
        self.size = int(units * self.k)
        self.img = Image.new("RGBA", (self.size, self.size))
        self.d = ImageDraw.Draw(self.img)

    def u(self, v):
        return v * self.k

    def box(self, cx, cy, rx, ry):
        return [self.u(cx - rx), self.u(cy - ry), self.u(cx + rx), self.u(cy + ry)]

    def pts(self, points):
        return [(self.u(x), self.u(y)) for x, y in points]

    def mask(self):
        m = Image.new("L", (self.size, self.size))
        return m, ImageDraw.Draw(m)

    def layer(self, rgba):
        self.img.alpha_composite(rgba)

    def outline(self, m, width):
        """Ink around a mask, `width` units thick."""
        grown = m.filter(ImageFilter.MaxFilter(int(self.u(width) * 2) | 1))
        ink = Image.new("RGBA", (self.size, self.size), INK)
        self.img.paste(ink, (0, 0), grown)

    def volume(self, m, color, radius=4.0, deep=0.45, light=1.35, gloss=True):
        """Fills mask `m` with `color` as a puffy shape: edges round off over `radius` units,
        lit from the top left with soft cel bands, plus a gloss spot near the top left."""
        a = np.asarray(m, float) / 255
        inside = a > 0.5
        dist = ndimage.distance_transform_edt(inside) / self.k
        t = np.clip(dist / radius, 0, 1)
        h = np.sqrt(1 - (1 - t) ** 2)
        gy, gx = np.gradient(h * radius * self.k)
        n = np.dstack([-gx, -gy, np.full_like(h, self.k * 0.9)])
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        lam = (n * LIGHT_DIR).sum(axis=2)
        base = np.array(color[:3], float)
        darker, lighter = base * deep, np.minimum(255, base * light + 30)
        s1 = smooth(0.25, 0.5, lam)[..., None]
        s2 = smooth(0.82, 0.97, lam)[..., None]
        col = darker * (1 - s1) + base * s1
        col = col * (1 - s2) + lighter * s2
        out = np.zeros((self.size, self.size, 4), np.uint8)
        out[..., :3] = np.clip(col, 0, 255)
        out[..., 3] = np.clip(a * 255, 0, 255)
        self.layer(Image.fromarray(out, "RGBA"))
        if gloss:
            bb = m.getbbox()
            if bb:
                w, hh = (bb[2] - bb[0]) / self.k, (bb[3] - bb[1]) / self.k
                gx0, gy0 = bb[0] / self.k + w * 0.3, bb[1] / self.k + hh * 0.27
                g = Image.new("RGBA", (self.size, self.size))
                ImageDraw.Draw(g).ellipse(self.box(gx0, gy0, max(0.6, w * 0.13), max(0.4, hh * 0.08)), fill=(255, 255, 255, 170))
                g = g.filter(ImageFilter.GaussianBlur(self.k * 0.15))
                clip = Image.new("L", (self.size, self.size))
                clip.paste(g.getchannel("A"), (0, 0), m)
                g.putalpha(clip)
                self.layer(g)

    def glow(self, cx, cy, r, color, blur=0.6):
        g = Image.new("RGBA", (self.size, self.size))
        ImageDraw.Draw(g).ellipse(self.box(cx, cy, r, r), fill=color)
        self.layer(g.filter(ImageFilter.GaussianBlur(self.k * blur)))

    def star(self, cx, cy, r_out, r_in, fill, outline=None, rot=0.0, points=5):
        p = [(cx + math.cos(rot + i * math.pi / points - math.pi / 2) * (r_out if i % 2 == 0 else r_in),
              cy + math.sin(rot + i * math.pi / points - math.pi / 2) * (r_out if i % 2 == 0 else r_in)) for i in range(points * 2)]
        self.d.polygon(self.pts(p), fill=fill, outline=outline, width=int(self.k * 0.25) if outline else 0)

    def done(self):
        return self.img.resize((int(self.units * self.px), int(self.units * self.px)), Image.LANCZOS)
