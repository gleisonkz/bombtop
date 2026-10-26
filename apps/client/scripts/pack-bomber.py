"""Export arena and title textures from the canonical 9 x 19 Bomber sheet.

bomber-sheet.png contains the 18 SHEETS.bomber rows followed by nine menu-flight
inventory frames. The title texture retains its dedicated high-resolution source.
"""
import json
from pathlib import Path

from PIL import Image


CLIENT = Path(__file__).resolve().parents[1]
PROFILE = CLIENT.parents[1] / "concept/characters.identity.json"
GRID = json.loads(PROFILE.read_text(encoding="utf-8"))["animationGrid"]
SOURCE = PROFILE.parent / GRID["master"]["path"]
MENU_SOURCE = PROFILE.parent / GRID["menu"]["approvedSource"]["path"]
FRAME_W, FRAME_H = GRID["runtimeGameplay"]["cell"]
MASTER_FRAME_W, MASTER_FRAME_H = GRID["master"]["cell"]
COLS, GAME_ROWS = GRID["runtimeGameplay"]["columns"], GRID["runtimeGameplay"]["rows"]


def export_sheets(source: Image.Image, menu: Image.Image) -> tuple[Image.Image, Image.Image]:
    expected = (COLS * MASTER_FRAME_W, (GAME_ROWS + 1) * MASTER_FRAME_H)
    if source.mode != "RGBA" or source.size != expected:
        raise ValueError(f"Expected RGBA compiled Bomber sheet {expected}, got {source.mode} {source.size}")
    gameplay = Image.new("RGBA", (COLS * FRAME_W, GAME_ROWS * FRAME_H))
    for row in range(GAME_ROWS):
        for col in range(COLS):
            frame = source.crop((col * MASTER_FRAME_W, row * MASTER_FRAME_H, (col + 1) * MASTER_FRAME_W, (row + 1) * MASTER_FRAME_H))
            frame = frame.resize((FRAME_W, FRAME_H), Image.Resampling.LANCZOS)
            gameplay.alpha_composite(frame, (col * FRAME_W, row * FRAME_H))
    menu_size = tuple(GRID["menu"]["approvedSource"]["size"])
    if menu.mode != "RGBA" or menu.size != menu_size:
        raise ValueError(f"Expected RGBA menu source {menu_size}, got {menu.mode} {menu.size}")
    title = menu.resize(tuple(GRID["menu"]["runtime"]["size"]), Image.Resampling.LANCZOS)
    return gameplay, title


def pack() -> None:
    with Image.open(SOURCE) as source, Image.open(MENU_SOURCE) as menu:
        gameplay, title = export_sheets(source, menu)
        preview_width, preview_height = GRID["runtimePreview"]["size"]
        preview = source.crop((0, 0, preview_width, preview_height))
    for name, image in (("bomber-atlas.png", gameplay), ("bomber-menu-atlas.png", preview), ("bomber-title-fly.png", title)):
        output = CLIENT / "public/sprites" / name
        image.save(output, optimize=True)
        print(f"Packed {output}: {image.width}x{image.height}")


if __name__ == "__main__":
    pack()
