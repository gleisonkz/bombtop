"""Pack the broader Goku transformation into a candidate by default.

python apps/client/scripts/pack-goku-lobby.py [--write]
Source drawings are immutable. Keypose zero uses the actual gameplay idle pixels.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = ROOT / "concept/goku/gameplay-redraw/lobby-packing.json"
CONFIG = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
SOURCE = CONFIG_PATH.parent / CONFIG["source"]["file"]
BASE = ROOT / CONFIG["base"]["file"]
OUTPUT = ROOT / ".agent/goku-lobby-wide-candidate.png"
CONTACT = ROOT / ".agent/goku-lobby-wide-contact.png"
PREVIEW = ROOT / ".agent/goku-lobby-wide-preview.gif"
MEASUREMENTS = ROOT / ".agent/goku-lobby-wide-measurements.json"
CELL = tuple(CONFIG["cell"])
ANCHOR = tuple(CONFIG["anchor"])
SCALE = CONFIG["scale"]
PLAYBACK = (0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0, 0)


def verify_sources():
    for path, record in ((SOURCE, CONFIG["source"]), (BASE, CONFIG["base"])):
        if hashlib.sha256(path.read_bytes()).hexdigest() != record["sha256"]:
            raise ValueError(f"Source changed; remeasure before packing: {path}")
    if CONFIG["playback"] != list(PLAYBACK):
        raise ValueError("Playback contract changed")


def source_frame(source, index):
    """Clean isolated aura debris and fade only the outer source seam."""
    pose = CONFIG["poses"][index]
    left, top, right, bottom = pose["source_box"]
    pixels = np.array(source.crop((left, top, right, bottom)))
    labels, _ = ndimage.label(pixels[:, :, 3] >= CONFIG["alpha_threshold"], np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    keep = ndimage.binary_dilation(sizes[labels] >= CONFIG["minimum_component_pixels"], iterations=1)
    pixels[~keep | (pixels[:, :, 3] < 8)] = 0
    y, x = np.indices(pixels.shape[:2])
    distance = np.minimum.reduce((x, pixels.shape[1] - 1 - x, y, pixels.shape[0] - 1 - y))
    pixels[:, :, 3] = np.rint(pixels[:, :, 3] * np.clip(distance / CONFIG["seam_pixels"], 0, 1)).astype(np.uint8)
    pixels[pixels[:, :, 3] == 0] = 0
    cx, ground = pose["boot_anchor"]
    return Image.fromarray(pixels), (cx - left, ground - top)


def register(frame, anchor, scale):
    size = tuple(round(dimension * scale) for dimension in frame.size)
    frame = frame.resize(size, Image.Resampling.NEAREST)
    offset = tuple(round(target - origin * scale) for target, origin in zip(ANCHOR, anchor))
    cell = Image.new("RGBA", CELL)
    cell.alpha_composite(frame, offset)
    return cell


def build_keyposes():
    verify_sources()
    with Image.open(BASE) as image:
        idle = image.convert("RGBA").crop(CONFIG["base"]["cell"])
    frames = [register(idle, CONFIG["base"]["anchor"], CONFIG["base"]["scale"])]
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    if source.size != tuple(CONFIG["source"]["size"]):
        raise ValueError("Source dimensions changed")
    for index in range(1, 8):
        frame, anchor = source_frame(source, index)
        frames.append(register(frame, anchor, SCALE))
    return frames


def build_frames():
    keyposes = build_keyposes()
    return [keyposes[index].copy() for index in PLAYBACK]


def build_sheet():
    sheet = Image.new("RGBA", (CELL[0] * 16, CELL[1]))
    for index, frame in enumerate(build_frames()):
        sheet.alpha_composite(frame, (index * CELL[0], 0))
    return sheet


def save_previews(frames):
    contact = Image.new("RGB", (CELL[0] * 8, CELL[1] + 22), "#576271")
    draw = ImageDraw.Draw(contact)
    preview = []
    for index, frame in enumerate(frames[:8]):
        x = index * CELL[0]
        contact.paste(frame, (x, 22), frame)
        draw.text((x + 4, 4), f"pose {index}", fill="white")
    contact.save(CONTACT)
    for frame in frames:
        canvas = Image.new("RGB", CELL, "#576271")
        canvas.paste(frame, (0, 0), frame)
        preview.append(canvas.resize((256, 414), Image.Resampling.NEAREST))
    preview[0].save(PREVIEW, save_all=True, append_images=preview[1:], duration=140,
                    loop=0, optimize=False, disposal=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Promote candidate after visual approval")
    args = parser.parse_args()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet = build_sheet()
    sheet.save(OUTPUT)
    if args.write:
        sheet.save(ROOT / "apps/client/public/sprites/goku-lobby.png")
    frames = [sheet.crop((i * 128, 0, (i + 1) * 128, 207)) for i in range(16)]
    save_previews(frames)
    bounds = [frame.getbbox() for frame in frames]
    union = [min(b[0] for b in bounds), min(b[1] for b in bounds),
             max(b[2] for b in bounds), max(b[3] for b in bounds)]
    records = {"alpha_union": union, "frame_bounds": bounds, "generated_scale": SCALE,
               "idle_scale": CONFIG["base"]["scale"], "idle_body_height": 142,
               "generated_body_heights": [round((p["boot_anchor"][1] - p["body_top"]) * SCALE)
                                           for p in CONFIG["poses"][1:]],
               "candidate_sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}
    MEASUREMENTS.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(records))
    print(f"Candidate: {OUTPUT}\nContact: {CONTACT}\nMotion: {PREVIEW}")


if __name__ == "__main__":
    main()
