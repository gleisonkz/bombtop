"""Pack approved Naruto families without repainting or per-pose normalization.

Requires Pillow, numpy, scipy. Default: approved-redraw/naruto-candidate.png
and report.json. Only --write promotes to public/sprites/naruto.png.
--contact and --gif optionally export diagnostics alongside the candidate.

Optional --manifest JSON, keyed by family name, for example:
{"idle": {"source_boxes": {"0": [[x0,y0,x1,y1], ...]},
          "row_bounds": [[0,362],[362,724],[724,1086]]}}
Boxes/bands are exclusive-right/bottom source coordinates; row keys are runtime
rows. Boxes select complete components, never cut them. Each overridden row
must supply exactly count boxes in playback order. Unselected substantial
components and overlapping selections fail. Hash-lock reviewed input with an
optional family sha256. minimum_component_pixels defaults to 64; use a reviewed
manifest override only when legitimate detached body parts need a smaller floor.
An optional family target_height overrides the default 109 only by explicit
measurement (e.g. 104 when taller later poses overflow). The first pose still
determines one fixed scale for that entire family, including all death frames.
Without --manifest, all approved-family first-pose heights target 109 pixels.
Native atlas: 864x2304, nine columns / eighteen rows of 96x128 cells,
feet anchor (48,124), with the same 108 authored poses.

Automatic assignment uses component centers in rough horizontal row bands,
then left-to-right order. No hard cell crops are used. Count ambiguities,
source-edge contact, and target overflow fail with measured component boxes.
Connected props/FX cannot be identified semantically: coordinator visual QA is
required. This tool neither draws repairs nor guesses how touching poses split.

If source-dir/edge-cleanup.json exists, replay its exact reviewed patches after
packing. atlas_sha256_before hashes the deterministic PNG before cleanup.
patches entries are [x,y,expectedRGBA,replacementRGBA]. Only opaque red fringe
(R>180,G<70,B<70) within two pixels of transparency may become #1b1511;
alpha is frozen. Distance uses 8-connected pixel steps to transparent pixels.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "concept/naruto/approved-redraw"
COUNTS = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]
CELL = (96, 128)
ANCHOR = (48, 124)
CONNECTIVITY = np.ones((3, 3), dtype=bool)
REVIEWED_TARGET_HEIGHTS = {"idle": 109, "walk": 109, "reaction": 109, "cast": 109,
                           "carry-idle": 109, "carry-walk": 109, "menu": 109}


class PackingError(ValueError):
    """Include measurements in CLI failure reports without publishing an atlas."""

    def __init__(self, message, **details):
        super().__init__(message)
        self.details = details


def components(image, minimum_pixels):
    if image.mode != "RGBA":
        raise PackingError("Expected RGBA source with authored alpha")
    if not isinstance(minimum_pixels, int) or minimum_pixels < 1:
        raise PackingError("minimum_component_pixels must be a positive integer")
    pixels = np.array(image)
    labels, _ = ndimage.label(pixels[:, :, 3] >= 128, CONNECTIVITY)
    sizes = np.bincount(labels.ravel())
    found = []
    for label, slices in enumerate(ndimage.find_objects(labels), 1):
        if slices is None or sizes[label] < minimum_pixels:
            continue
        ys, xs = slices
        found.append({"label": label, "box": [xs.start, ys.start, xs.stop, ys.stop],
                      "pixels": int(sizes[label])})
    return pixels, labels, found


def select_box(box, found, image_size):
    if (len(box) != 4 or any(type(v) is not int for v in box)
            or not 0 <= box[0] < box[2] <= image_size[0]
            or not 0 <= box[1] < box[3] <= image_size[1]):
        raise PackingError(f"Invalid measured source box {box}")
    selected = []
    for component in found:
        x0, y0, x1, y1 = component["box"]
        intersects = x0 < box[2] and x1 > box[0] and y0 < box[3] and y1 > box[1]
        if not intersects:
            continue
        if x0 < box[0] or y0 < box[1] or x1 > box[2] or y1 > box[3]:
            raise PackingError(f"Measured box {box}: clipping component {component['box']}")
        selected.append(component)
    if not selected:
        raise PackingError(f"Measured source box {box} contains no substantial body component")
    return selected


def row_groups(found, family, size, overrides):
    rows = family["rows"]
    bands = overrides.get("row_bounds", [[i * size[1] / len(rows), (i + 1) * size[1] / len(rows)]
                                          for i in range(len(rows))])
    if (len(bands) != len(rows)
            or any(not 0 <= top < bottom <= size[1] for top, bottom in bands)
            or any(bands[i][1] > bands[i + 1][0] for i in range(len(bands) - 1))):
        raise PackingError("row_bounds must be ordered, nonoverlapping source y bands")
    overrides_by_row = overrides.get("source_boxes", {})
    valid_rows = {str(row["row"]) for row in rows}
    if set(overrides_by_row) - valid_rows:
        raise PackingError("source_boxes contains unknown runtime row keys")
    result = []
    for row, (top, bottom) in zip(rows, bands):
        boxes = overrides_by_row.get(str(row["row"]))
        if boxes is not None:
            groups = [select_box(box, found, size) for box in boxes]
        else:
            matches = [c for c in found if top <= (c["box"][1] + c["box"][3]) / 2 < bottom]
            matches.sort(key=lambda c: (c["box"][0], c["box"][1]))
            groups = [[c] for c in matches]
        if len(groups) != row["count"]:
            raise PackingError(f"{family['name']} row {row['row']}: count {len(groups)}, expected {row['count']}; "
                               "review source_boxes/row_bounds", components=found)
        result.append(groups)
    selected = [c["label"] for groups in result for group in groups for c in group]
    expected = {c["label"] for c in found}
    if len(selected) != len(set(selected)) or set(selected) != expected:
        raise PackingError("Duplicate or unassigned substantial components; review count/boxes", components=found)
    return result


def extract_family(image, family, *, overrides=None, minimum_pixels=64):
    """Return tight crops containing only selected source RGB and binary alpha."""
    overrides = overrides or {}
    minimum_pixels = overrides.get("minimum_component_pixels", minimum_pixels)
    pixels, labels, found = components(image, minimum_pixels)
    for component in found:
        x0, y0, x1, y1 = component["box"]
        if x0 == 0 or y0 == 0 or x1 == image.width or y1 == image.height:
            raise PackingError(f"{family['name']}: source clipping at {component['box']}", components=found)
    groups = row_groups(found, family, image.size, overrides)
    extracted = []
    for row, poses in zip(family["rows"], groups):
        frames = []
        for col, group in enumerate(poses):
            box = [min(c["box"][0] for c in group), min(c["box"][1] for c in group),
                   max(c["box"][2] for c in group), max(c["box"][3] for c in group)]
            x0, y0, x1, y1 = box
            selected = np.isin(labels[y0:y1, x0:x1], [c["label"] for c in group])
            crop = pixels[y0:y1, x0:x1].copy()
            crop[~selected] = 0
            crop[selected, 3] = 255
            frames.append((Image.fromarray(crop), {"family": family["name"], "row": row["row"],
                           "column": col, "source_box": box,
                           "source_component_boxes": [c["box"] for c in group],
                           "source_pixels": int(selected.sum())}))
        extracted.append(frames)
    return extracted


def source_anchor(image, row):
    pixels = np.array(image)[:, :, 3] >= 128
    if row == 7:  # Falling silhouettes keep the same family scale, centered at ground.
        return [image.width / 2, image.height]
    bottom = pixels[max(0, int(image.height * 0.84)):]
    _, xs = np.where(bottom)
    return [(int(xs.min()) + int(xs.max()) + 1) / 2, image.height]


def register_family(rows, family, *, target_height=109):
    """One uniform scale from first standing pose, reused for every family frame."""
    if not np.isfinite(target_height) or target_height <= 0:
        raise PackingError("target_height must be positive and finite")
    scale = target_height / rows[0][0][0].height
    result = []
    for frames in rows:
        for image, details in frames:
            anchor = source_anchor(image, details["row"])
            width, height = (max(1, round(v * scale)) for v in image.size)
            resized = image.resize((width, height), Image.Resampling.NEAREST)
            # Integer image dimensions imply small rounding differences; register
            # the actual resampled anchor and report both effective axis scales.
            effective = [width / image.width, height / image.height]
            scaled_anchor = [anchor[i] * effective[i] for i in range(2)]
            offset = [round(ANCHOR[i] - scaled_anchor[i]) for i in range(2)]
            bounds = resized.getbbox()
            low, high = 1 - bounds[0], CELL[0] - 1 - bounds[2]
            if low > high:
                raise PackingError(f"{family['name']} row {details['row']} frame {details['column']}: "
                                   f"cannot fit width {width}; no squashing permitted", frame=details, scale=scale)
            original_x = offset[0]
            offset[0] = max(low, min(offset[0], high))
            placed = [bounds[i] + offset[i % 2] for i in range(4)]
            if placed[1] < 1 or placed[3] > CELL[1] - 2:
                raise PackingError(f"{family['name']} row {details['row']} frame {details['column']}: "
                                   f"target clipping at {placed}", frame=details, scale=scale)
            cell = Image.new("RGBA", CELL)
            cell.paste(resized, tuple(offset))
            result.append((cell, {**details, "scale": scale, "effective_scale": effective,
                           "source_anchor": anchor, "source_anchor_absolute": [anchor[i] + details['source_box'][i] for i in range(2)],
                           "target_anchor": list(ANCHOR),
                           "registered_anchor": [offset[i] + scaled_anchor[i] for i in range(2)],
                           "horizontal_fit_shift": offset[0] - original_x,
                           "offset": offset, "bbox": list(cell.getbbox()),
                           "sha256": hashlib.sha256(cell.tobytes()).hexdigest()}))
    return result, scale


def validate_contract(contract):
    if tuple(contract["frame"]) != CELL or tuple(contract["anchor"]) != ANCHOR:
        raise PackingError("Contract must use 96x128 cells, anchor (48,124)")
    rows = [row for family in contract["families"] for row in family["rows"]]
    if sorted((row["row"], row["count"]) for row in rows) != list(enumerate(COUNTS)):
        raise PackingError("Contract must contain exactly the original 18 rows / 108 frames")
    names = [family["name"] for family in contract["families"]]
    if len(set(names)) != len(names) or any(Path(name).name != name or "/" in name or "\\" in name for name in names):
        raise PackingError("Family names must be unique plain file stems")


def build_sheet(source_dir, contract, *, manifest=None, minimum_pixels=64):
    validate_contract(contract)
    if manifest is None:
        manifest = {family["name"]: {"target_height": REVIEWED_TARGET_HEIGHTS[family["name"]]}
                    for family in contract["families"] if family["name"] in REVIEWED_TARGET_HEIGHTS}
    names = {family["name"] for family in contract["families"]}
    if set(manifest) - names:
        raise PackingError("Manifest contains unknown family names")
    missing = [f"{name}.generated.png" for name in sorted(names) if not (source_dir / f"{name}.generated.png").is_file()]
    if missing:
        raise PackingError("Missing source families: " + ", ".join(missing), missing=missing)
    atlas = Image.new("RGBA", (864, 2304))
    report = {"frame": list(CELL), "anchor": list(ANCHOR), "size": list(atlas.size),
              "alpha_threshold": 128, "sources": {}, "frames": []}
    for family in contract["families"]:
        name = family["name"]
        path = source_dir / f"{name}.generated.png"
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        options = manifest.get(name, {})
        if options.get("sha256", digest) != digest:
            raise PackingError(f"{name}: reviewed source sha256 mismatch")
        with Image.open(io.BytesIO(raw)) as image:
            extracted = extract_family(image, family, overrides=options, minimum_pixels=minimum_pixels)
            target_height = options.get("target_height", 109)
            frames, scale = register_family(extracted, family, target_height=target_height)
            report["sources"][name] = {"file": path.name, "sha256": digest, "size": list(image.size),
                                       "scale": scale, "scale_reference": frames[0][1]["source_box"],
                                       "target_height": target_height,
                                       "minimum_component_pixels": options.get("minimum_component_pixels", minimum_pixels)}
        for cell, record in frames:
            atlas.paste(cell, (record["column"] * CELL[0], record["row"] * CELL[1]))
            report["frames"].append(record)
    cleanup = source_dir / "edge-cleanup.json"
    if cleanup.exists():
        raw_cleanup = cleanup.read_bytes()
        atlas, audit = apply_edge_cleanup(atlas, json.loads(raw_cleanup))
        report["edge_cleanup"] = {**audit, "file": cleanup.name,
                                  "manifest_sha256": hashlib.sha256(raw_cleanup).hexdigest()}
        for record in report["frames"]:
            x, y = record["column"] * CELL[0], record["row"] * CELL[1]
            cell = atlas.crop((x, y, x + CELL[0], y + CELL[1]))
            record["sha256"] = hashlib.sha256(cell.tobytes()).hexdigest()
    report["frame_count"] = len(report["frames"])
    report["atlas_sha256"] = hashlib.sha256(png_bytes(atlas)).hexdigest()
    return atlas, report


def apply_edge_cleanup(atlas, review):
    before_hash = hashlib.sha256(png_bytes(atlas)).hexdigest()
    if review.get("atlas_sha256_before") != before_hash:
        raise PackingError("Edge cleanup before hash mismatch")
    patches = review.get("patches")
    if not isinstance(patches, list):
        raise PackingError("Edge cleanup patches must be a list")
    pixels = np.array(atlas)
    edge_distance = ndimage.distance_transform_cdt(pixels[:, :, 3] >= 128, metric="chessboard")
    selected = set()
    for patch in patches:
        if not isinstance(patch, list) or len(patch) != 4:
            raise PackingError("Invalid edge cleanup patch entry")
        x, y, expected, replacement = patch
        if type(x) is not int or type(y) is not int or not 0 <= x < atlas.width or not 0 <= y < atlas.height:
            raise PackingError("Edge cleanup coordinate outside atlas")
        if (x, y) in selected:
            raise PackingError(f"Duplicate edge cleanup coordinate {(x, y)}")
        selected.add((x, y))
        for rgba in (expected, replacement):
            if not isinstance(rgba, list) or len(rgba) != 4 or any(type(v) is not int or not 0 <= v <= 255 for v in rgba):
                raise PackingError("Edge cleanup RGBA must contain four byte integers")
        if pixels[y, x].tolist() != expected:
            raise PackingError(f"Edge cleanup expected RGBA mismatch at {(x, y)}")
        if expected[3] != replacement[3]:
            raise PackingError(f"Edge cleanup alpha change forbidden at {(x, y)}")
        red = expected[0] > 180 and expected[1] < 70 and expected[2] < 70 and expected[3] >= 128
        if not red or not 1 <= edge_distance[y, x] <= 2 or replacement[:3] != [27, 21, 17]:
            raise PackingError(f"Edge cleanup violates reviewed red/edge/outline limits at {(x, y)}")
    # Validate the complete list before replaying any change, including duplicates.
    for x, y, _, replacement in patches:
        pixels[y, x] = replacement
    result = Image.fromarray(pixels)
    return result, {"atlas_sha256_before": before_hash, "patch_count": len(patches),
                    "atlas_sha256_after": hashlib.sha256(png_bytes(result)).hexdigest()}


def png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False, compress_level=9)
    return buffer.getvalue()


def save_diagnostics(atlas, directory, *, contact=False, gif=False):
    if contact:
        canvas = Image.new("RGB", (9 * (CELL[0] + 4) + 48, 18 * (CELL[1] + 20)), "#46515e")
        draw = ImageDraw.Draw(canvas)
        for row in range(18):
            draw.text((2, row * (CELL[1] + 20) + 30), str(row), fill="white")
            for col in range(COUNTS[row]):
                cell = atlas.crop((col * CELL[0], row * CELL[1], (col + 1) * CELL[0], (row + 1) * CELL[1]))
                canvas.paste(cell, (48 + col * (CELL[0] + 4), row * (CELL[1] + 20) + 16), cell)
        (directory / "naruto-contact.png").write_bytes(png_bytes(canvas))
    if gif:
        frames = []
        for tick in range(18):
            canvas = Image.new("RGB", (6 * CELL[0], 3 * CELL[1]), "#46515e")
            for row, count in enumerate(COUNTS):
                col = tick % count
                cell = atlas.crop((col * CELL[0], row * CELL[1], (col + 1) * CELL[0], (row + 1) * CELL[1]))
                canvas.paste(cell, ((row % 6) * CELL[0], (row // 6) * CELL[1]), cell)
            frames.append(canvas)
        frames[0].save(directory / "naruto-preview.gif", save_all=True, append_images=frames[1:],
                       duration=120, loop=0, optimize=False, disposal=2)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--minimum-pixels", type=int, default=64)
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument("--output", type=Path)
    destination.add_argument("--write", action="store_true", help="Explicitly promote public Naruto atlas")
    parser.add_argument("--contact", action="store_true")
    parser.add_argument("--gif", action="store_true")
    args = parser.parse_args(argv)
    directory = args.source_dir.resolve()
    public = (ROOT / "apps/client/public/sprites/naruto.png").resolve()
    output = (public if args.write else args.output or directory / "naruto-candidate.png").resolve()
    if output == public and not args.write:
        parser.error("Public promotion requires --write")
    protected = {p.resolve() for p in directory.glob("*.generated.png")}
    protected.update({(directory / name).resolve() for name in ("contract.json", "report.json", "edge-cleanup.json")})
    if args.manifest:
        protected.add(args.manifest.resolve())
    if output in protected:
        parser.error("Output would overwrite a source, manifest, contract, or report")
    try:
        contract = json.loads((directory / "contract.json").read_text(encoding="utf-8"))
        manifest = json.loads(args.manifest.read_text(encoding="utf-8")) if args.manifest else None
        atlas, report = build_sheet(directory, contract, manifest=manifest, minimum_pixels=args.minimum_pixels)
    except (ValueError, OSError, KeyError, TypeError) as error:
        failure = {"status": "failed", "error": str(error), **getattr(error, "details", {})}
        if directory.is_dir():
            (directory / "report.json").write_text(json.dumps(failure, indent=2) + "\n", encoding="utf-8")
        parser.exit(1, f"Packing failed: {error}\n")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(png_bytes(atlas))
    report["status"] = "packed; requires coordinator visual QA"
    report["output"] = str(output)
    (directory / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    save_diagnostics(atlas, directory, contact=args.contact, gif=args.gif)
    print(f"108 frames, 864x2304 RGBA -> {output}\nReport: {directory / 'report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
