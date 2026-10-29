"""Pack the 107 approved option4 poses; never redraw, repair, or shrink to fit.

Requires Pillow, numpy and scipy (same as pack-naruto-approved.py).
Default writes concept/static/option4-redraw/static-candidate.png, report.json,
and static-paint-regions.json (candidate metadata, never runtime JSON).
Only --write promotes apps/client/public/sprites/static-final.png (rows 0-17) and
static-victory.png (row 18, kept apart to stay under 4096 px); runtime JSON
remains coordinator-owned. --contact/--gif produce optional review artifacts.

Optional --manifest (defaults to source-dir/measurements.json when present)
uses Naruto's reviewed source_boxes, row_bounds,
minimum_component_pixels and sha256 per family. No target-height overrides.
One scale per whole family comes from its first standing pose, targeting 148px.
If that pose includes a raised arm/prop, standing_height may explicitly supply
the measured standing body height in source pixels; this is recorded, never
inferred from subsequent frames or changed to fit. Nearest-neighbor only.
Victory row 18, column 6 keeps its authored jump: a 12 native-pixel lift
after normal foot registration, checked against the same transparent gutters.
Disconnected legitimate props need reviewed source_boxes grouping components.
All substantial components must be assigned; semantic no-FX QA is external.
"""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / 'concept/static/option4-redraw'
CELL = (168, 224)
ANCHOR = (82, 208)
COLUMNS = 14
BODY_HEIGHT = 148
FAMILY_ROWS = {
    'idle': ((0, 4), (1, 4), (2, 4)),
    'walk': ((3, 5), (4, 4), (5, 5)),
    'reaction': ((6, 6), (7, 7)),
    'cast': ((8, 6), (9, 7), (10, 4)),
    'carry-idle': ((11, 4), (12, 4), (13, 4)),
    'carry-walk': ((14, 6), (15, 6), (16, 6)),
    'menu': ((17, 10),),
    'victory': ((18, 11),),
}
COUNTS = tuple(count for rows in FAMILY_ROWS.values() for _, count in rows)


def load_helpers(filename, name):
    """Import definitions only: both existing packers guard their CLI builds."""
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SEGMENTATION = load_helpers('pack-naruto-approved.py', 'static_approved_segmentation')
PROTECTION = load_helpers('pack-static.py', 'static_approved_protection')
PackingError = SEGMENTATION.PackingError
extract_family = SEGMENTATION.extract_family
png_bytes = SEGMENTATION.png_bytes


def validate_contract(contract):
    if (tuple(contract['frame']) != CELL or tuple(contract['anchor']) != ANCHOR
            or contract['columns'] != COLUMNS):
        raise PackingError('Contract requires 168x224 cells, anchor (82,208), 14 columns')
    actual = [(f['name'], tuple((r['row'], r['count']) for r in f['rows']))
              for f in contract['families']]
    if actual != list(FAMILY_ROWS.items()):
        raise PackingError('Contract requires exactly the approved eight families / 19 rows / 107 frames')


def source_anchor(image, row):
    if row == 7:  # Falling silhouettes: ground center, same reaction family scale.
        return [image.width / 2, image.height]
    visible = np.array(image)[:, :, 3] >= 128
    _, xs = np.where(visible[int(image.height * .84):])
    return [(int(xs.min()) + int(xs.max()) + 1) / 2, image.height]


def register_family(rows, family, *, standing_height=None):
    """Register all poses with one measured family scale; fail rather than crop."""
    reference_height = rows[0][0][0].height if standing_height is None else standing_height
    if (isinstance(reference_height, bool) or not isinstance(reference_height, (int, float))
            or not np.isfinite(reference_height) or reference_height <= 0):
        raise PackingError('standing_height must be a positive finite source-pixel measurement')
    scale = BODY_HEIGHT / reference_height
    result = []
    for frames in rows:
        for image, details in frames:
            width, height = (max(1, round(value * scale)) for value in image.size)
            resized = image.resize((width, height), Image.Resampling.NEAREST)
            bounds = resized.getbbox()
            if bounds is None:
                raise PackingError('Pose vanished during sampling; need geometry review', frame=details)
            anchor = source_anchor(image, details['row'])
            effective = [width / image.width, height / image.height]
            scaled_anchor = [anchor[i] * effective[i] for i in range(2)]
            offset = [round(ANCHOR[i] - scaled_anchor[i]) for i in range(2)]
            jump_lift = 12 if details['row'] == 18 and details['column'] == 6 else 0
            offset[1] -= jump_lift
            low, high = 1 - bounds[0], CELL[0] - 1 - bounds[2]
            if low > high:
                raise PackingError(f"{family['name']}: width {width} exceeds 166px; need geometry, never shrink family",
                                   frame=details, scale=scale, measured_size=[width, height])
            original_x = offset[0]
            offset[0] = max(low, min(offset[0], high))
            placed = [bounds[i] + offset[i % 2] for i in range(4)]
            if placed[1] < 1 or placed[3] > CELL[1] - 1:
                raise PackingError(f"{family['name']}: target clipping at {placed}; need geometry, never shrink family",
                                   frame=details, scale=scale, measured_size=[width, height])
            cell = Image.new('RGBA', CELL)
            cell.paste(resized, tuple(offset))
            result.append((cell, {**details, 'scale': scale, 'effective_scale': effective,
                           'standing_height': reference_height, 'source_anchor': anchor,
                           'source_anchor_absolute': [anchor[i] + details['source_box'][i] for i in range(2)],
                           'target_anchor': list(ANCHOR), 'jump_lift': jump_lift,
                           'offset': offset, 'target_box': placed,
                           'registered_anchor': [offset[i] + scaled_anchor[i] for i in range(2)],
                           'horizontal_adjustment': offset[0] - original_x,
                           'sha256': hashlib.sha256(cell.tobytes()).hexdigest()}))
    return result, scale


def build_sheet(source_dir, contract, *, manifest=None, minimum_pixels=64):
    validate_contract(contract)
    source_dir = Path(source_dir)
    manifest = {} if manifest is None else manifest
    if set(manifest) - FAMILY_ROWS.keys():
        raise PackingError('Manifest contains unknown family names')
    missing = [f'{name}.generated.png' for name in FAMILY_ROWS
               if not (source_dir / f'{name}.generated.png').is_file()]
    if missing:
        raise PackingError('Missing source families: ' + ', '.join(missing), missing=missing)
    atlas = Image.new('RGBA', (COLUMNS * CELL[0], len(COUNTS) * CELL[1]))
    protection_rows = [[] for _ in COUNTS]
    report = {'frame': list(CELL), 'anchor': list(ANCHOR), 'columns': COLUMNS,
              'size': list(atlas.size), 'alpha_threshold': 128, 'target_body_height': BODY_HEIGHT,
              'sources': {}, 'frames': []}
    for family in contract['families']:
        name = family['name']
        path = source_dir / f'{name}.generated.png'
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        options = manifest.get(name, {})
        if 'target_height' in options:
            raise PackingError('target_height overrides forbidden; body target is always 148px')
        if options.get('sha256', digest) != digest:
            raise PackingError(f'{name}: reviewed source sha256 mismatch')
        with Image.open(io.BytesIO(raw)) as image:
            extracted = extract_family(image, family, overrides=options, minimum_pixels=minimum_pixels)
            frames, scale = register_family(extracted, family, standing_height=options.get('standing_height'))
            report['sources'][name] = {'file': path.name, 'sha256': digest, 'size': list(image.size),
                                       'scale': scale, 'standing_height': frames[0][1]['standing_height'],
                                       'scale_reference': frames[0][1]['source_box'],
                                       'minimum_component_pixels': options.get('minimum_component_pixels', minimum_pixels)}
        for cell, record in frames:
            row, col = record['row'], record['column']
            atlas.paste(cell, (col * CELL[0], row * CELL[1]))
            left, top, right, bottom = cell.getbbox()
            try:
                regions = PROTECTION.frame_protection(cell.crop((left, top, right, bottom)),
                                                      left, top, disc=row == 17)
            except ValueError as error:
                raise PackingError(f'{name} frame {col}: {error}', frame=record) from error
            protection_rows[row].append(regions)
            report['frames'].append(record)
    report['paint_regions'] = {'frameW': CELL[0], 'frameH': CELL[1], 'rows': protection_rows}
    report['frame_count'] = len(report['frames'])
    report['atlas_sha256'] = hashlib.sha256(png_bytes(atlas)).hexdigest()
    return atlas, report


def save_diagnostics(atlas, directory, *, contact=False, gif=False):
    if contact:
        canvas = Image.new('RGB', atlas.size, '#46515e')
        canvas.paste(atlas, (0, 0), atlas)
        draw = ImageDraw.Draw(canvas)
        for row, count in enumerate(COUNTS):
            draw.text((2, row * CELL[1] + 2), f'{row}: {count}', fill='white')
        canvas.save(directory / 'static-contact.png')
    if gif:
        frames = []
        for tick in range(max(COUNTS)):
            canvas = Image.new('RGB', (5 * CELL[0], 4 * CELL[1]), '#46515e')
            for row, count in enumerate(COUNTS):
                col = tick % count
                cell = atlas.crop((col * CELL[0], row * CELL[1], (col + 1) * CELL[0], (row + 1) * CELL[1]))
                canvas.paste(cell, ((row % 5) * CELL[0], (row // 5) * CELL[1]), cell)
            frames.append(canvas)
        frames[0].save(directory / 'static-preview.gif', save_all=True, append_images=frames[1:],
                       duration=120, loop=0, optimize=False, disposal=2)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--source-dir', type=Path, default=SOURCE_DIR)
    parser.add_argument('--manifest', type=Path, help='Reviewed measurements; defaults to source-dir/measurements.json when present')
    parser.add_argument('--minimum-pixels', type=int, default=64)
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument('--output', type=Path)
    destination.add_argument('--write', action='store_true', help='Explicit atlas promotion only; no runtime JSON edits')
    parser.add_argument('--contact', action='store_true')
    parser.add_argument('--gif', action='store_true')
    args = parser.parse_args(argv)
    directory = args.source_dir.resolve()
    manifest_path = args.manifest
    if manifest_path is None and (directory / 'measurements.json').is_file():
        manifest_path = directory / 'measurements.json'
    public_dir = (ROOT / 'apps/client/public').resolve()
    output = ((public_dir / 'sprites/static-final.png') if args.write else
              (args.output or directory / 'static-candidate.png')).resolve()
    if output.is_relative_to(public_dir) and not args.write:
        parser.error('Public promotion requires --write')
    protected = {p.resolve() for p in directory.iterdir() if p.is_file()} if directory.is_dir() else set()
    protected.discard((directory / 'static-candidate.png').resolve())
    if manifest_path:
        protected.add(manifest_path.resolve())
    if output in protected:
        parser.error('Output would overwrite an input or review artifact')
    try:
        contract = json.loads((directory / 'contract.json').read_text(encoding='utf-8'))
        manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path else None
        atlas, report = build_sheet(directory, contract, manifest=manifest, minimum_pixels=args.minimum_pixels)
    except (ValueError, OSError, KeyError, TypeError) as error:
        failure = {'status': 'failed', 'error': str(error), **getattr(error, 'details', {})}
        if directory.is_dir():
            (directory / 'report.json').write_text(json.dumps(failure, indent=2) + '\n', encoding='utf-8')
        parser.exit(1, f'Packing failed: {error}\n')
    output.parent.mkdir(parents=True, exist_ok=True)
    if args.write:
        # Phone GPUs cap a texture at 4096 px: the victory row (18) ships as its own image, static-victory.png.
        cell_h = atlas.height // 19
        output.write_bytes(png_bytes(atlas.crop((0, 0, atlas.width, 18 * cell_h))))
        (output.parent / 'static-victory.png').write_bytes(png_bytes(atlas.crop((0, 18 * cell_h, atlas.width, atlas.height))))
    else:
        output.write_bytes(png_bytes(atlas))
    report['status'] = 'packed; requires coordinator visual QA'
    report['output'] = str(output)
    protection_path = directory / 'static-paint-regions.json'
    protection_path.write_text(json.dumps(report['paint_regions'], separators=(',', ':')) + '\n', encoding='utf-8')
    report['protection_output'] = str(protection_path)
    (directory / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    save_diagnostics(atlas, directory, contact=args.contact, gif=args.gif)
    print(f"107 frames, 2352x4256 RGBA -> {output}\nReport: {directory / 'report.json'}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
