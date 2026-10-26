"""Pack the original brick settling into destruction, anchored to one floor baseline."""
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parents[3] / "concept/tiles/block-break-source.png"
IGNITION = SOURCE.with_name("block-ignition-overlays.png")
BLOCK = SOURCE.with_name("intact-block-reference.png")
SIZE = 128


def ignition_frames():
    """Composite progressively growing generated FX onto the actual unchanged brick bitmap."""
    source = Image.open(IGNITION).convert("RGBA")
    if source.width != source.height * 3:
        raise ValueError("Ignition overlays must be three square cells in one row")
    base = Image.open(BLOCK).convert("RGBA")
    if base.size != (SIZE, SIZE):
        raise ValueError("Intact block reference must remain the native 128x128 tile")
    result = []
    current = base.copy()
    for index in range(3):
        overlay = source.crop((index * source.height, 0, (index + 1) * source.height, source.height))
        overlay = overlay.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        # Effect inventory belongs to the brick face; the existing golden cap remains exact.
        overlay.paste((0, 0, 0, 0), (0, 0, SIZE, SIZE // 4))
        current.alpha_composite(overlay)
        result.append(current.copy())
    return result


def burning():
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (1536, 1024):
        raise ValueError("Approved block-break source must be 1536x1024")
    # Measured ownership boundaries isolate the generated grid's uneven spacing.
    # Every pose uses the SAME 500-pixel window and 128/500 scale: solid bricks
    # retain their tile footprint; only destruction itself reduces the heap.
    columns = (0, 532, 1004, 1536)
    centers = (289, 768, 1250)
    result = []
    for index in range(6):
        col, row = index % 3, index // 3
        origin_x, origin_y = centers[col] - 250, (538 if row == 0 else 978) - 500
        left, right = max(origin_x, columns[col]), min(origin_x + 500, columns[col + 1])
        top, bottom = max(origin_y, 0 if row == 0 else 550), min(origin_y + 500, 550 if row == 0 else 1024)
        cell = Image.new("RGBA", (500, 500))
        cell.alpha_composite(source.crop((left, top, right, bottom)), (left - origin_x, top - origin_y))
        result.append(cell.resize((SIZE, SIZE), Image.Resampling.LANCZOS))
    ignition = []
    # A restrained downward compression precedes the rubble: never recenter on the shrinking bounds.
    for frame, size in zip(ignition_frames(), ((128, 128), (126, 123), (122, 116))):
        cell = Image.new("RGBA", (SIZE, SIZE))
        cell.alpha_composite(frame.resize(size, Image.Resampling.LANCZOS), ((SIZE - size[0]) // 2, SIZE - size[1]))
        ignition.append(cell)
    return [*ignition, *result[3:]]
