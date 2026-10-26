"""Rebuild Harry's menu summon with a coherent galloping orbit.

Run: python apps/client/scripts/pack-harry-lobby.py
The preserved source supplies only clean resting/raising/casting Harry poses;
its old orbit frames are deliberately never reused. Gameplay art is not changed.
"""
from pathlib import Path
import math

import numpy as np
from PIL import Image, ImageDraw

CLIENT = Path(__file__).resolve().parents[1]
SOURCE = CLIENT.parents[1] / "concept/harry/menu-source.png"
STAG = CLIENT / "public/sprites/patronus.png"
HARRY = CLIENT / "public/sprites/harry.png"
OUTPUT = CLIENT / "public/sprites/harry-lobby-patronus-v2.png"
WIDTH, HEIGHT, FRAMES = 320, 208, 48
ANCHOR = (112, 194)
WAND = (117, 125)


def hero_frame(frame):
    if frame < 4 or frame >= 38:
        return 0
    if frame < 10:
        return (1, 1, 2, 2, 3, 4)[frame - 4]
    if frame <= 35:
        return 5
    return 5


def stag_pose(frame):
    if not 14 <= frame < 40:
        return None
    age = frame - 14
    angle = age * math.tau / 25
    depth = math.sin(angle)
    return {"x": ANCHOR[0] + math.cos(angle) * 64, "y": 183.5 + depth * 19.5,
            "alpha": min(1, (age + 1) / 7) * min(1, (40 - frame) / 6),
            "reveal": min(1, (age + 1) / 7), "frame": age % 8,
            "flip": depth >= 0, "behind": depth < 0, "scale": 0.92 + depth * 0.08}


def draw_stag(canvas, sheet, pose):
    frame = sheet.crop((pose["frame"] * 96, 0, (pose["frame"] + 1) * 96, 96))
    pixels = np.array(frame)
    # The muzzle/antlers resolve first, followed by the body and legs. The stag
    # keeps its proportions, with only a small depth change around the orbit.
    x = np.arange(96)[None, :]
    reveal = np.clip((x - (1 - pose["reveal"]) * 110 + 22) / 22, 0, 1)
    pixels[:, :, 3] = np.rint(pixels[:, :, 3] * reveal * pose["alpha"]).astype(np.uint8)
    image = Image.fromarray(pixels)
    if pose["flip"]:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    size = round(96 * pose["scale"])
    image = image.resize((size, size), Image.Resampling.NEAREST)
    canvas.alpha_composite(image, (round(pose["x"] - size / 2), round(pose["y"] - 84 * size / 96)))


def draw_spark(draw, x, y, alpha, size=1):
    x, y = round(x), round(y)
    draw.line((x - size, y, x + size, y), fill=(183, 228, 255, round(alpha)))
    draw.line((x, y - size, x, y + size), fill=(225, 248, 255, round(alpha)))


def draw_magic(canvas, frame, pose):
    light = Image.new("RGBA", canvas.size)
    draw = ImageDraw.Draw(light)
    if 10 <= frame < 23:
        charge = min(1, (frame - 9) / 5)
        radius = 2 + charge * 2 + math.sin(frame * 0.7) * 0.5
        x, y = WAND
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(223, 248, 255, 180))
        if pose:
            for k in range(10):
                t = k / 9
                px = x + (pose["x"] - 15 - x) * t
                py = y + (pose["y"] - 35 - y) * t - math.sin(t * math.pi) * 10
                draw_spark(draw, px, py, 150 * (1 - t) * pose["alpha"])
    if pose:
        direction = 1 if pose["flip"] else -1
        for k in range(4):
            draw_spark(draw, pose["x"] + direction * (26 + k * 6),
                       pose["y"] - 26 + math.sin(frame * 0.45 + k) * 4,
                       125 * (1 - k / 4) * pose["alpha"])
    if 34 <= frame < 44:
        fade = min(1, (frame - 33) / 4) * (44 - frame) / 10
        last = stag_pose(min(frame, 39))
        source = np.array(Image.open(STAG).crop((last["frame"] * 96, 0, (last["frame"] + 1) * 96, 96)))
        ys, xs = np.where(source[:, :, 3] > 160)
        if last["flip"]:
            xs = 95 - xs
        for k in range(16):
            at = k * len(xs) // 16
            draw_spark(draw, last["x"] + (xs[at] - 48) * last["scale"] + (frame - 34) * 1.5,
                       last["y"] + (ys[at] - 84) * last["scale"] - (frame - 34) * 1.5,
                       200 * fade, 1)
    canvas.alpha_composite(light)


def build_frames():
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    with Image.open(STAG) as image:
        stag = image.convert("RGBA")
    with Image.open(HARRY) as image:
        harry = image.convert("RGBA")
    frames = []
    for frame in range(FRAMES):
        cell = Image.new("RGBA", (WIDTH, HEIGHT))
        index = hero_frame(frame)
        hero = source.crop((index * 270, 0, (index + 1) * 270, 171))
        pose = stag_pose(frame)
        if pose and pose["behind"]:
            draw_stag(cell, stag, pose)
            draw_magic(cell, frame, pose)
        if frame in (36, 37):
            column = 3 if frame == 36 else 0
            hero = harry.crop((column * 152, 8 * 168, (column + 1) * 152, 9 * 168))
            cell.alpha_composite(hero, (round(ANCHOR[0] - 78.5), ANCHOR[1] - 164))
        else:
            cell.alpha_composite(hero, (ANCHOR[0] - 135, ANCHOR[1] - 157))
        if pose and not pose["behind"]:
            draw_stag(cell, stag, pose)
        if not pose or not pose["behind"]:
            draw_magic(cell, frame, pose)
        frames.append(cell)
    return frames


def build_sheet():
    sheet = Image.new("RGBA", (WIDTH * FRAMES, HEIGHT))
    for index, frame in enumerate(build_frames()):
        sheet.alpha_composite(frame, (index * WIDTH, 0))
    return sheet


if __name__ == "__main__":
    build_sheet().save(OUTPUT)
    print(f"{FRAMES} coherent menu frames: {OUTPUT}")
