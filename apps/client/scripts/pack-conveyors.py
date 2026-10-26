"""Register approved conveyor pixels; move rubber independently of metal rails."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
CONCEPT = ROOT / "concept" / "conveyors"
SOURCE = CONCEPT / "conveyor-concept.png"
OUTPUT = ROOT / "apps" / "client" / "public" / "sprites" / "conveyors.png"
CELL = 128
PHASES = 16
RAIL_HEIGHT = 14
# Half-open boxes in the untouched 1254 x 1254 source. Inset rail crops
# exclude the rounded black outer corners without repainting the artwork.
TOP_BOX = (20, 113, 1234, 214)
RUBBER_BOX = (4, 224, 1250, 1036)
BOTTOM_BOX = (20, 1045, 1234, 1146)
OVERLAP = 128


def periodic_crop(source, box, height):
    """Overlap tail/head so the retained texture has a continuous wrap seam."""
    pixels = np.asarray(source.crop(box).convert("RGB"), dtype=np.float64)
    # Endpoints exactly retain adjacent original pixels; smoothstep keeps
    # the blend derivative flat where it rejoins the untouched source.
    t = np.linspace(0, 1, OVERLAP)[None, :, None]
    weight = t * t * (3 - 2 * t)
    seam = pixels[:, -OVERLAP:] * (1 - weight) + pixels[:, :OVERLAP] * weight
    periodic = np.concatenate((pixels[:, OVERLAP:-OVERLAP], seam), axis=1)
    image = Image.fromarray(np.rint(periodic).astype(np.uint8))
    # Tile before Lanczos filtering so edge samples see their periodic
    # neighbours rather than clamping at the crop boundary.
    tiled = Image.new("RGB", (image.width * 3, image.height))
    for repeat in range(3):
        tiled.paste(image, (repeat * image.width, 0))
    return tiled.resize((CELL * 3, height), Image.Resampling.LANCZOS).crop(
        (CELL, 0, CELL * 2, height)).convert("RGBA")


def build_sheet():
    with Image.open(SOURCE) as source:
        if source.size != (1254, 1254):
            raise ValueError("Approved source dimensions changed; review crop registration")
        top = periodic_crop(source, TOP_BOX, RAIL_HEIGHT)
        bottom = periodic_crop(source, BOTTOM_BOX, RAIL_HEIGHT)
        rubber = np.asarray(periodic_crop(source, RUBBER_BOX, CELL - RAIL_HEIGHT * 2))
    sheet = Image.new("RGBA", (CELL * PHASES, CELL * 4))
    rotations = (None, Image.Transpose.ROTATE_270,
                 Image.Transpose.ROTATE_180, Image.Transpose.ROTATE_90)
    for phase in range(PHASES):
        frame = Image.new("RGBA", (CELL, CELL))
        frame.paste(top, (0, 0))
        frame.paste(Image.fromarray(np.roll(rubber, phase * (CELL // PHASES), axis=1)),
                    (0, RAIL_HEIGHT))
        frame.paste(bottom, (0, CELL - RAIL_HEIGHT))
        for row, rotation in enumerate(rotations):
            oriented = frame if rotation is None else frame.transpose(rotation)
            sheet.paste(oriented, (phase * CELL, row * CELL))
    return sheet


def save_preview(sheet):
    """Four repeated tiles per direction at a 48px game-sized inspection scale."""
    frames = []
    for phase in range(PHASES):
        preview = Image.new("RGB", (48 * 4, 48 * 6), (44, 48, 58))
        for row in range(4):
            tile = sheet.crop((phase * CELL, row * CELL,
                               (phase + 1) * CELL, (row + 1) * CELL))
            tile = tile.resize((48, 48), Image.Resampling.LANCZOS)
            # Horizontal rows for right/left, vertical columns for down/up.
            for repeat in range(4):
                if row in (1, 3):
                    position = ((row == 3) * 48, 96 + repeat * 48)
                else:
                    position = (repeat * 48, (row // 2) * 48)
                preview.paste(tile, position)
        frames.append(preview)
    frames[0].save(CONCEPT / "conveyor-preview.png")
    frames[0].save(CONCEPT / "conveyor-preview.gif", save_all=True,
                   append_images=frames[1:], duration=[30, 30, 40] * 5 + [30],
                   loop=0, disposal=2)


if __name__ == "__main__":
    atlas = build_sheet()
    atlas.save(OUTPUT)
    save_preview(atlas)
    print(OUTPUT)
