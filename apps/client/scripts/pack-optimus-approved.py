"""Pack approved Optimus sources into candidates; --write explicitly promotes art.

Uses Naruto's offline component extraction unchanged. Optional --manifest accepts
the same source_boxes, row_bounds, minimum_component_pixels and sha256 locks,
keyed by family (including truck/fist). No per-frame normalization or paint/FX.
transform.generated.png holds three intermediate poses per view, rows down/side/up.
Cast's 12 slots are idle + three intermediates + truck1 + truck0, then exact reverse.
One scale from the first transform pose targets 164px for the entire family.
Optional transform.fixed_scale overrides that factor. Historical cast.generated.png
is unused. Truck boundaries use native scale .26/.134.
Carry/fist use first-pose helmet-to-foot height 164, inferred from the central
35%-65% alpha band. A manifest scale_reference_box [x0,y0,x1,y1] in absolute
source coordinates overrides that measurement (first extracted pose only).
Other gameplay uses full first-pose height 164; truck scales once per row to its
first-pose height target, reduced uniformly only to fit every pose in that row.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

SPEC = importlib.util.spec_from_file_location("naruto_offline_extraction", Path(__file__).with_name("pack-naruto-approved.py"))
EXTRACTION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXTRACTION)
extract_family = EXTRACTION.extract_family
components = EXTRACTION.components
source_anchor = EXTRACTION.source_anchor
PackingError = EXTRACTION.PackingError
png_bytes = EXTRACTION.png_bytes

ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "concept/optimus/approved-redraw"
CELL = (224, 224)
ANCHOR = (111.5, 211)
COUNTS = [4, 4, 4, 6, 6, 6, 6, 7, 12, 12, 12, 4, 4, 4, 6, 6, 6]
FAMILY_ROWS = {"idle": [0, 1, 2], "walk": [3, 4, 5], "reaction": [6, 7],
               "cast": [8, 9, 10], "carry-idle": [11, 12, 13], "carry-walk": [14, 15, 16]}
TRUCK_FAMILY = {"name": "truck", "rows": [{"row": i, "count": 4} for i in range(3)]}
FIST_FAMILY = {"name": "fist", "rows": [{"row": 0, "count": 2}]}
TRANSFORM_FAMILY = {"name": "transform", "rows": [{"row": i, "count": 3} for i in (8, 9, 10)]}
TRUCK_TO_ROBOT_SCALE = 0.26 / 0.134


def validate_contract(contract):
    if (contract.get("frame") != list(CELL) or contract.get("anchor") != list(ANCHOR)
            or contract.get("target_body_height") != 164 or contract.get("gameplay_counts") != COUNTS
            or contract.get("columns") != 12):
        raise PackingError("Contract requires 12 columns, 224x224, anchor (111.5,211), body 164 and 109 slots")
    families = contract["families"]
    if len(families) != len(FAMILY_ROWS) or {f["name"] for f in families} != set(FAMILY_ROWS):
        raise PackingError("Contract must contain exactly the six gameplay families")
    for family in families:
        expected = [{"row": row, "count": COUNTS[row]} for row in FAMILY_ROWS[family["name"]]]
        if family["rows"] != expected:
            raise PackingError(f"Invalid row/count contract: {family['name']}")


def scale_reference(rows, family, options):
    """Measure once, keeping overhead hands out of the body-height reference."""
    image, details = rows[0][0]
    x0, y0, x1, y1 = details["source_box"]
    measured = options.get("scale_reference_box")
    if measured is not None:
        if (not isinstance(measured, list) or len(measured) != 4
                or any(type(v) is not int for v in measured)
                or not x0 <= measured[0] < measured[2] <= x1
                or not y0 <= measured[1] < measured[3] <= y1):
            raise PackingError("scale_reference_box must lie inside the first extracted source pose")
        box = [measured[0] - x0, measured[1] - y0, measured[2] - x0, measured[3] - y0]
        mode = "measured-source-box"
    elif family["name"] in ("carry-idle", "carry-walk", "fist"):
        left, right = int(image.width * 0.35), max(1, int(image.width * 0.65))
        band = image.getchannel("A").crop((left, 0, right, image.height))
        bounds = band.getbbox()
        if bounds is None:
            raise PackingError(f"{family['name']}: central band has no helmet/body alpha; supply scale_reference_box")
        box = [left, bounds[1], right, image.height]
        mode = "central-35-65-percent"
    else:
        box, mode = [0, 0, image.width, image.height], "full-first-pose"
    return {"mode": mode, "source_box": [box[0] + x0, box[1] + y0, box[2] + x0, box[3] + y0],
            "height": box[3] - box[1], "target_body_height": 164}


def register(rows, family, *, cell=CELL, anchor=ANCHOR, scale=None, horizontal_margin=1, options=None):
    """Register one fixed family scale; fail instead of cropping or squashing."""
    reference = scale_reference(rows, family, options or {})
    scale = 164 / reference["height"] if scale is None else scale
    records = []
    for frames in rows:
        for image, details in frames:
            origin = source_anchor(image, details["row"])
            size = tuple(max(1, round(value * scale)) for value in image.size)
            resized = image.resize(size, Image.Resampling.NEAREST)
            effective = [size[i] / image.size[i] for i in range(2)]
            scaled = [origin[i] * effective[i] for i in range(2)]
            offset = [round(anchor[i] - scaled[i]) for i in range(2)]
            bounds = resized.getbbox()
            low, high = horizontal_margin - bounds[0], cell[0] - horizontal_margin - bounds[2]
            if low > high:
                raise PackingError(f"{family['name']} row {details['row']} frame {details['column']}: cannot fit width", frame=details)
            initial_x = offset[0]
            offset[0] = max(low, min(high, offset[0]))
            placed = [bounds[i] + offset[i % 2] for i in range(4)]
            if placed[1] < 1 or placed[3] > cell[1] - 1:
                raise PackingError(f"{family['name']} target clipping at {placed}", frame=details)
            canvas = Image.new("RGBA", cell)
            canvas.paste(resized, tuple(offset))
            records.append((canvas, {**details, "scale": scale, "scale_reference": reference, "effective_scale": effective,
                            "source_anchor": origin,
                            "source_anchor_absolute": [origin[i] + details["source_box"][i] for i in range(2)],
                            "target_anchor": list(anchor), "offset": offset,
                            "horizontal_fit_shift": offset[0] - initial_x,
                            "registered_anchor": [offset[i] + scaled[i] for i in range(2)],
                            "bbox": list(canvas.getbbox()),
                            "body_height": bounds[3] - bounds[1],
                            "sha256": hashlib.sha256(canvas.tobytes()).hexdigest()}))
    return records


def load_family(directory, family, options, minimum_pixels):
    path = directory / (family["name"] + ".generated.png")
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if options.get("sha256", digest) != digest:
        raise PackingError(f"{family['name']}: reviewed source sha256 mismatch")
    if "target_height" in options:
        raise PackingError("target_height overrides forbidden: fixed contract heights")
    with Image.open(io.BytesIO(raw)) as image:
        extracted = extract_family(image, family, overrides=options, minimum_pixels=minimum_pixels)
        metadata = {"file": path.name, "sha256": digest, "size": list(image.size)}
    return extracted, metadata


def assemble(frames, size, cell, anchor):
    atlas = Image.new("RGBA", size)
    for image, record in frames:
        atlas.paste(image, (record["column"] * cell[0], record["row"] * cell[1]))
    return atlas, {"size": list(size), "frame": list(cell), "anchor": list(anchor),
                   "frame_count": len(frames), "frames": [r for _, r in frames],
                   "atlas_sha256": hashlib.sha256(png_bytes(atlas)).hexdigest()}


def truck_boundary(truck, row, column):
    """Preserve runtime truck anchor and physical scale, cropping only clear pixels."""
    native = truck.crop((column * 128, row * 96, (column + 1) * 128, (row + 1) * 96))
    box = native.getbbox()
    tight = native.crop(box)
    size = tuple(round(value * TRUCK_TO_ROBOT_SCALE) for value in tight.size)
    image = tight.resize(size, Image.Resampling.NEAREST)
    effective = [size[i] / tight.size[i] for i in range(2)]
    origin = (64 - box[0], 90 - box[1])
    offset = [round(ANCHOR[i] - origin[i] * effective[i]) for i in range(2)]
    bounds = [offset[0], offset[1], offset[0] + size[0], offset[1] + size[1]]
    if bounds[0] < 1 or bounds[1] < 1 or bounds[2] > 223 or bounds[3] > 223:
        raise PackingError(f"Truck boundary row {row} cannot fit without clipping: {bounds}")
    canvas = Image.new("RGBA", CELL)
    canvas.paste(image, tuple(offset))
    return canvas, {"source_family": "truck", "truck_row": row, "source_column": column,
                    "native_box": list(box), "native_anchor": [64, 90],
                    "scale": TRUCK_TO_ROBOT_SCALE, "effective_scale": effective,
                    "runtime_scale": 0.26, "robot_runtime_scale": 0.134,
                    "offset": offset, "target_anchor": list(ANCHOR),
                    "registered_anchor": [offset[i] + origin[i] * effective[i] for i in range(2)],
                    "bbox": list(canvas.getbbox()), "body_height": size[1],
                    "sha256": hashlib.sha256(canvas.tobytes()).hexdigest()}


def compose_cast(gameplay, truck, transforms, options):
    """Six forward + six reverse slots; repeated endpoints are explicit holds."""
    result = []
    reference = scale_reference(transforms, TRANSFORM_FAMILY, options)
    factor = options.get("fixed_scale", 164 / reference["height"])
    if isinstance(factor, bool) or not isinstance(factor, (int, float)) or not math.isfinite(factor) or factor <= 0:
        raise PackingError("transform fixed_scale must be finite and positive")
    reference = {**reference, "mode": "explicit-fixed-scale" if "fixed_scale" in options else reference["mode"],
                 "file": "transform.generated.png"}
    for index, (idle_row, truck_row) in enumerate(((0, 1), (1, 0), (2, 2))):
        row = 8 + index
        intermediate = register([transforms[index]], TRANSFORM_FAMILY, scale=factor)
        intermediate = [(im, {**record, "source_family": "transform", "scale_reference": reference}) for im, record in intermediate]
        idle = next((im, record) for im, record in gameplay if record["row"] == idle_row and record["column"] == 0)
        idle = (idle[0], {**idle[1], "source_family": "idle", "source_row": idle_row, "source_column": 0})
        forward = [idle, *intermediate, truck_boundary(truck, truck_row, 1), truck_boundary(truck, truck_row, 0)]
        for column, (image, record) in enumerate(forward + list(reversed(forward))):
            result.append((image, {**record, "family": "cast", "row": row, "column": column,
                                   "intentional_reverse": column >= 6,
                                   "reverse_of_column": 11 - column if column >= 6 else None}))
    return result


def compose_menu(game, truck, fist):
    """Sixteen bare-art poses; only travelling vehicle frames may clip/vanish."""
    sequence = [("robot", 0, 0, 160), ("robot", 8, 1, 160),
                ("robot", 8, 2, 160), ("robot", 8, 3, 160)]
    sequence += [("truck", 0, i % 4, x) for i, x in enumerate((160, 176, 232, 314, 430, -30, 70, 152))]
    sequence += [("robot", 8, 9, 160), ("robot", 8, 10, 160),
                 ("fist", 0, 0, 160), ("fist", 0, 1, 160)]
    atlas = Image.new("RGBA", (5120, 224))
    records = []
    for index, (kind, row, column, center) in enumerate(sequence):
        canvas = Image.new("RGBA", (320, 224))
        if kind == "truck":
            image = truck.crop((column * 128, 0, (column + 1) * 128, 96))
            image = image.resize((256, 192), Image.Resampling.NEAREST)
            offset = (center - 128, 211 - 180)
        else:
            source = game if kind == "robot" else fist
            image = source.crop((column * 224, row * 224, (column + 1) * 224, (row + 1) * 224))
            # 160 - 111.5 = 48.5: raster placement necessarily rounds half a pixel.
            offset = (round(160 - ANCHOR[0]), 0)
        canvas.paste(image, offset)
        atlas.paste(canvas, (index * 320, 0))
        bbox = canvas.getbbox()
        records.append({"column": index, "kind": kind, "source_row": row, "source_column": column,
                        "center_x": center, "offset": list(offset), "allow_offcard": kind == "truck",
                        "bbox": list(bbox) if bbox else None})
    return atlas, {"size": [5120, 224], "frame": [320, 224], "anchor": [160, 211],
                   "frame_count": 16, "effects": "none", "robot_center_shift": 48.5,
                   "truck_scale": 2, "frames": records,
                   "atlas_sha256": hashlib.sha256(png_bytes(atlas)).hexdigest()}


def build_assets(directory, contract, *, manifest=None, minimum_pixels=64):
    validate_contract(contract)
    manifest = manifest or {}
    families = [f for f in contract["families"] if f["name"] != "cast"] + [TRANSFORM_FAMILY, TRUCK_FAMILY, FIST_FAMILY]
    names = {f["name"] for f in families}
    if set(manifest) - names:
        raise PackingError("Manifest contains unknown family names")
    missing = [name + ".generated.png" for name in sorted(names) if not (directory / (name + ".generated.png")).is_file()]
    if missing:
        raise PackingError("Missing source families: " + ", ".join(missing), missing=missing)
    sources, extracted = {}, {}
    for family in families:
        name = family["name"]
        extracted[name], sources[name] = load_family(directory, family, manifest.get(name, {}), minimum_pixels)
    gameplay = []
    for family in contract["families"]:
        if family["name"] == "cast":
            continue
        gameplay.extend(register(extracted[family["name"]], family, options=manifest.get(family["name"], {})))
    vehicle = []
    # Row order follows runtime TRUCK: side/right, front/down, rear/up.
    for row, target in zip(extracted["truck"], (56, 60, 58)):
        scale = min(target / row[0][0].height,
                    124 / max(image.width for image, _ in row),
                    86 / max(image.height for image, _ in row))
        vehicle.extend(register([row], TRUCK_FAMILY, cell=(128, 96), anchor=(64, 90),
                                scale=scale, horizontal_margin=2))
    truck, truck_report = assemble(vehicle, (512, 288), (128, 96), (64, 90))
    gameplay.extend(compose_cast(gameplay, truck, extracted["transform"], manifest.get("transform", {})))
    gameplay.sort(key=lambda item: (item[1]["row"], item[1]["column"]))
    game, game_report = assemble(gameplay, (2688, 3808), CELL, ANCHOR)
    game_report["cast_composition"] = "idle, transform0..2, truck1, truck0, truck0, truck1, transform2..0, idle; intentional mechanical reverse"
    fist, fist_report = assemble(register(extracted["fist"], FIST_FAMILY, options=manifest.get("fist", {})), (448, 224), CELL, ANCHOR)
    menu, menu_report = compose_menu(game, truck, fist)
    return {"optimus": game, "truck": truck, "fist2": fist, "optimus-menu16": menu}, {
        "alpha_threshold": 128, "sources": sources, "gameplay": game_report,
        "truck": truck_report, "fist": fist_report, "menu": menu_report}


def save_diagnostics(assets, report, directory, *, contact=False, gif=False):
    """Review-only composites on gray; candidates keep their original clean alpha."""
    outputs = []
    assets = {**assets, "optimus-cast": assets["optimus"]}
    report = {**report, "cast_review": {**report["gameplay"],
              "frames": [f for f in report["gameplay"]["frames"] if f["row"] in (8, 9, 10)]}}
    for name, key in (("optimus", "gameplay"), ("truck", "truck"), ("fist2", "fist"), ("optimus-menu16", "menu"), ("optimus-cast", "cast_review")):
        image, layout = assets[name], report[key]
        width, height = layout["frame"]
        rows = {}
        for frame in layout["frames"]:
            rows.setdefault(frame.get("row", 0), []).append(frame["column"])
        if contact:
            columns = 4 if key == "menu" else image.width // width
            cells = [(row, column) for row, values in sorted(rows.items()) for column in values]
            count_rows = (len(cells) + columns - 1) // columns
            canvas = Image.new("RGB", (columns * (width + 4), count_rows * (height + 20)), "#46515e")
            draw = ImageDraw.Draw(canvas)
            for index, (row, column) in enumerate(cells):
                x, y = index % columns * (width + 4), index // columns * (height + 20)
                draw.text((x + 2, y + 2), f"{row}:{column}", fill="white")
                cell = image.crop((column * width, row * height, (column + 1) * width, (row + 1) * height))
                canvas.paste(cell, (x, y + 18), cell)
            path = directory / f"{name}-contact.png"
            path.write_bytes(png_bytes(canvas))
            outputs.append(path.name)
        if gif:
            frames = []
            columns = 6 if key == "gameplay" else len(rows)
            bands = (len(rows) + columns - 1) // columns
            for tick in range(max(len(values) for values in rows.values())):
                canvas = Image.new("RGB", (columns * width, bands * height), "#46515e")
                for index, (row, values) in enumerate(sorted(rows.items())):
                    column = values[tick % len(values)]
                    cell = image.crop((column * width, row * height, (column + 1) * width, (row + 1) * height))
                    canvas.paste(cell, (index % columns * width, index // columns * height), cell)
                frames.append(canvas)
            path = directory / f"{name}-preview.gif"
            frames[0].save(path, save_all=True, append_images=frames[1:], duration=120,
                           loop=0, optimize=False, disposal=2)
            outputs.append(path.name)
    return outputs


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--minimum-pixels", type=int, default=64)
    parser.add_argument("--write", action="store_true", help="Explicitly promote gameplay, truck and lobby PNGs")
    parser.add_argument("--contact", action="store_true", help="Export labeled review contact sheets")
    parser.add_argument("--gif", action="store_true", help="Export gameplay, truck, fist and menu review loops")
    args = parser.parse_args(argv)
    directory = args.source_dir.resolve()
    public = (ROOT / "apps/client/public/sprites").resolve()
    if directory == public or public in directory.parents:
        parser.error("Source/candidate directory must be outside public sprites")
    try:
        contract = json.loads((directory / "contract.json").read_text(encoding="utf-8"))
        manifest = json.loads(args.manifest.read_text(encoding="utf-8")) if args.manifest else None
        assets, report = build_assets(directory, contract, manifest=manifest, minimum_pixels=args.minimum_pixels)
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, f"Packing failed: {error}\n")
    # Build every candidate successfully before writing anything, including promotion.
    for name, image in assets.items():
        (directory / f"{name}-candidate.png").write_bytes(png_bytes(image))
    if args.write:
        for name, destination in (("optimus", "optimus.png"), ("truck", "truck.png"), ("optimus-menu16", "optimus-lobby.png")):
            (public / destination).write_bytes(png_bytes(assets[name]))
    report["status"] = "promoted; requires coordinator registration and visual QA" if args.write else "candidate; requires coordinator visual QA"
    report["outputs"] = {name: f"{name}-candidate.png" for name in assets}
    report["diagnostics"] = save_diagnostics(assets, report, directory, contact=args.contact, gif=args.gif)
    (directory / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"109 gameplay slots + 12 truck + 2 fist + 16 menu frames -> {directory}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
