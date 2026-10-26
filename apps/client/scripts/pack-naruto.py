"""Deterministic registration of accepted Naruto drawings; never changes sources.

Run from any directory: python apps/client/scripts/pack-naruto.py
Requires Pillow, numpy and scipy. Measurements and source hashes live in packing.json.
Default output is a candidate; --output PATH or --write explicitly promotes after QA.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "concept/naruto/reference-remake"
CONFIG = json.loads((SOURCE_DIR / "packing.json").read_text(encoding="utf-8"))
CONTRACT = json.loads((SOURCE_DIR / "contract.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / ".agent/naruto-candidate.png"
CONTACT = ROOT / ".agent/naruto-candidate-contact.png"
PREVIEW = ROOT / ".agent/naruto-preview.gif"
CELL = tuple(CONTRACT["frame"])
ANCHOR = tuple(CONTRACT["anchor"])
CONNECTIVITY = np.ones((3, 3), dtype=bool)


def read_source(name, *, config=CONFIG, source_dir=SOURCE_DIR):
    """Fail closed on changed artwork: measurements must be reviewed again."""
    entry = config["sources"][name]
    path = source_dir / entry["file"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
        raise ValueError(f"{name}: source changed; remeasure before packing")
    with Image.open(path) as source:
        if source.mode != "RGBA" or list(source.size) != entry["size"]:
            raise ValueError(f"{name}: expected measured RGBA dimensions {entry['size']}")
        return np.array(source)


def extract_row(row, *, config=CONFIG, source_dir=SOURCE_DIR):
    """Extract full components inside reviewed bands, preserving original core alpha."""
    source = read_source(row["source"], config=config, source_dir=source_dir)
    top, bottom = row["y_bounds"]
    pixels = source[top:bottom]
    # A reviewed seam can divide touching authored outlines without deleting or
    # duplicating source pixels. It is not inferred from a requested grid.
    yy, xx = np.indices(pixels.shape[:2])
    zones = np.zeros(pixels.shape[:2], dtype=np.int32)
    for seam in row.get("seams", []):
        points = np.asarray(seam)
        boundary = np.interp(yy[:, 0] + top, points[:, 1], points[:, 0])
        zones += xx >= boundary[:, None]
    labels = np.zeros(pixels.shape[:2], dtype=np.int32)
    last_label = 0
    for zone in range(len(row.get("seams", [])) + 1):
        mask = (pixels[:, :, 3] >= config["alpha_threshold"]) & (zones == zone)
        zone_labels, count = ndimage.label(mask, CONNECTIVITY)
        occupied = zone_labels > 0
        labels[occupied] = zone_labels[occupied] + last_label
        last_label += count
    sizes = np.bincount(labels.ravel())
    if row.get("seams"):
        # Splitting a touching outline can detach legitimate small islands.
        # Preserve every pixel of the original substantial core, assigning each
        # island to the nearest pose on its reviewed side of the seam.
        original, _ = ndimage.label(pixels[:, :, 3] >= config["alpha_threshold"], CONNECTIVITY)
        original_sizes = np.bincount(original.ravel())
        original_sizes[0] = 0
        original_core = original_sizes[original] >= config["minimum_component_pixels"]
        for zone in range(len(row["seams"]) + 1):
            seeds = np.where((zones == zone) & (labels > 0)
                             & (sizes[labels] >= config["minimum_component_pixels"]), labels, 0)
            if not seeds.any():
                raise ValueError("Reviewed seam produced a zone without a substantial pose")
            nearest = ndimage.distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
            selected = (zones == zone) & original_core
            labels[selected] = seeds[tuple(nearest)][selected]
        sizes = np.bincount(labels.ravel())
    objects = ndimage.find_objects(labels)
    components = [(label, box) for label, box in enumerate(objects, 1)
                  if sizes[label] >= config["minimum_component_pixels"]]
    components.sort(key=lambda item: item[1][1].start)
    if len(components) != row["frames"]:
        raise ValueError(f"{row['source']} band {top}:{bottom}: expected {row['frames']} "
                         f"components, found {len(components)}")
    frames = []
    for label, box in components:
        # One source pixel of soft edge support; no opaque redraw or halo synthesis.
        support = ndimage.binary_dilation(labels == label, structure=CONNECTIVITY,
                                          iterations=config["edge_support_pixels"])
        if row.get("seams"):
            component_zone = int(np.bincount(zones[labels == label]).argmax())
            support &= zones == component_zone
        support &= pixels[:, :, 3] > 0
        ys, xs = np.where(support)
        left, right = int(xs.min()), int(xs.max()) + 1
        upper, lower = int(ys.min()), int(ys.max()) + 1
        isolated = pixels[upper:lower, left:right].copy()
        isolated[~support[upper:lower, left:right]] = 0
        isolated[isolated[:, :, 3] == 0] = 0
        frames.append((Image.fromarray(isolated), {
            "source": row["source"],
            "source_box": [left, top + upper, right, top + lower],
            "core_box": [box[1].start - left, box[0].start - upper,
                         box[1].stop - left, box[0].stop - upper],
        }))
    return frames


def foot_anchor(frame, core_box, family):
    """Register boots, not head/hands; horizontal death uses its full silhouette."""
    pixels = np.asarray(frame).astype(float)
    left, top, right, ground = core_box
    if family in ("death", "knockdown"):
        return ((left + right) / 2, ground)
    blue = ((pixels[:, :, 2] > pixels[:, :, 0] * 1.15)
            & (pixels[:, :, 2] > pixels[:, :, 1] * 1.03)
            & (pixels[:, :, 3] >= 128))
    blue[:round(ground - (ground - top) * 0.16)] = False
    _, xs = np.where(blue)
    if not len(xs):
        raise ValueError("No boot pixels at measured ground; review anchor")
    return ((int(xs.min()) + int(xs.max()) + 1) / 2, ground)


def register_frame(frame, details, family, *, config=CONFIG, cell=CELL, anchor=ANCHOR):
    scale = config["scales"][family]
    source_anchor = foot_anchor(frame, details["core_box"], family)
    # Fixed family scale, never normalize individual drawing height or width.
    size = tuple(round(dimension * scale) for dimension in frame.size)
    resized = frame.resize(size, Image.Resampling.NEAREST)
    offset = tuple(round(target - origin * scale) for target, origin in zip(anchor, source_anchor))
    bounds = resized.getbbox()
    # Extended punches can overhang the boot midpoint by more than half a cell.
    # Translate by the minimum required amount, never squash or crop the drawing.
    horizontal = max(1 - bounds[0], min(offset[0], cell[0] - 1 - bounds[2]))
    fit_shift = horizontal - offset[0]
    offset = (horizontal, offset[1])
    placed = tuple(bounds[i] + offset[i % 2] for i in range(4))
    if placed[0] < 1 or placed[1] < 1 or placed[2] > cell[0] - 1 or placed[3] > cell[1] - 2:
        raise ValueError(f"{family} {details['source_box']}: bounds {placed} would crop or breach gutter")
    registered = Image.new("RGBA", cell)
    registered.alpha_composite(resized, offset)
    pixels = np.array(registered)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels), {
        **details, "family": family, "scale": scale,
        "horizontal_fit_shift": fit_shift,
        "source_anchor": list(source_anchor), "target_anchor": list(anchor),
        "registered_anchor": [offset[i] + source_anchor[i] * scale for i in range(2)],
    }


def build_sheet():
    counts = {row["runtimeRow"]: row["frames"]
              for panel in CONTRACT["panels"] for row in panel["rows"]}
    rows = CONFIG["rows"]
    if {r["runtime_row"]: r["frames"] for r in rows} != counts or len(rows) != 18:
        raise ValueError("Packing rows disagree with immutable runtime contract")
    repair = CONFIG["repair"]
    repair_frames = extract_row(repair)
    replacements = dict(zip(map(tuple, repair["targets"]), repair_frames))
    sheet = Image.new("RGBA", (CELL[0] * CONTRACT["atlas"][0], CELL[1] * CONTRACT["atlas"][1]))
    records = []
    for row in rows:
        frames = extract_row(row)
        for column, (frame, details) in enumerate(frames):
            key = (row["runtime_row"], column)
            family = row["family"]
            if key in replacements:
                frame, details = replacements[key]
                family = repair["family"]
            cell, record = register_frame(frame, details, family)
            sheet.alpha_composite(cell, (column * CELL[0], key[0] * CELL[1]))
            records.append({**record, "row": key[0], "column": column})
    if len(records) != 108:
        raise ValueError("Expected exactly 108 authored frames")
    return sheet, records


def save_png(image, destination):
    """Explicit compression and no timestamp/metadata for repeatable bytes."""
    image.save(destination, format="PNG", optimize=False, compress_level=9)


def contact_sheet(sheet):
    contact = Image.new("RGB", (9 * 84 + 90, 18 * 132), "#263241")
    draw = ImageDraw.Draw(contact)
    for row in range(18):
        draw.text((4, row * 132 + 48), f"row {row}", fill="white")
        for col in range(9):
            x, y = 90 + col * 84, row * 132 + 14
            draw.rectangle((x, y, x + 79, y + 115), fill="#576271")
            cell = sheet.crop((col * 80, row * 116, (col + 1) * 80, (row + 1) * 116))
            contact.paste(cell, (x, y), cell)
            draw.text((x + 2, y - 12), str(col), fill="white")
    return contact


def save_preview(sheet):
    """Show every runtime row in order, including every distinct authored frame."""
    counts = [r["frames"] for r in CONFIG["rows"]]
    preview = []
    # Bounded preview; each row cycles through every authored pose in order.
    for tick in range(18):
        canvas = Image.new("RGB", (6 * 160, 3 * 250), "#576271")
        draw = ImageDraw.Draw(canvas)
        for row, count in enumerate(counts):
            col = tick % count
            cell = sheet.crop((col * 80, row * 116, (col + 1) * 80, (row + 1) * 116))
            cell = cell.resize((160, 232), Image.Resampling.NEAREST)
            x, y = (row % 6) * 160, (row // 6) * 250 + 18
            canvas.paste(cell, (x, y), cell)
            draw.text((x + 3, y - 15), f"row {row} frame {col}", fill="white")
        preview.append(canvas)
    preview[0].save(PREVIEW, save_all=True, append_images=preview[1:], duration=120,
                    loop=0, optimize=False, disposal=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument("--output", type=Path, help="Explicit destination PNG; default is candidate")
    destination.add_argument("--write", action="store_true", help="Promote to public/sprites/naruto.png after QA")
    args = parser.parse_args()
    output = args.output or (ROOT / "apps/client/public/sprites/naruto.png" if args.write else OUTPUT)
    output = output.resolve()
    if output in {SOURCE_DIR / source["file"] for source in CONFIG["sources"].values()}:
        parser.error("Sources are immutable; choose a different output")
    atlas, measurements = build_sheet()
    output.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    save_png(atlas, output)
    save_png(contact_sheet(atlas), CONTACT)
    save_preview(atlas)
    print(f"108 authored frames, {atlas.size} RGBA, anchor {ANCHOR}: {output}")
    print(f"Contact: {CONTACT}\nMotion preview: {PREVIEW}")


if __name__ == "__main__":
    main()
