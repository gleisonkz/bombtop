"""Pack immutable Goku redraws into a candidate atlas by default.

python apps/client/scripts/pack-goku.py [--partial | --write]
The partial option exports only available panels and reports missing rows explicitly.
Use --write only after coordinator QA to promote the complete atlas.
"""
import argparse
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[3]
SOURCE_DIR = ROOT / "concept/goku/gameplay-redraw"
CONFIG = json.loads((SOURCE_DIR / "packing.json").read_text(encoding="utf-8"))
CONTRACT = json.loads((SOURCE_DIR / "contract.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / ".agent/goku-candidate.png"
CONTACT = ROOT / ".agent/goku-candidate-contact.png"
PREVIEW = ROOT / ".agent/goku-preview.gif"
MEASUREMENTS = ROOT / ".agent/goku-candidate-measurements.json"
CELL = tuple(CONTRACT["frame"])
ANCHOR = tuple(CONTRACT["anchor"])
spec = importlib.util.spec_from_file_location("naruto_registration", Path(__file__).with_name("pack-naruto.py"))
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


def build_sheet(*, partial=False):
    counts = {row["runtimeRow"]: row["frames"] for panel in CONTRACT["panels"] for row in panel["rows"]}
    if {r["runtime_row"]: r["frames"] for r in CONFIG["rows"]} != counts or len(CONFIG["rows"]) != 18:
        raise ValueError("Packing rows disagree with immutable runtime contract")
    sheet = Image.new("RGBA", (CELL[0] * 9, CELL[1] * 18))
    records = []
    for row in CONFIG["rows"]:
        if row["source"] not in CONFIG["sources"]:
            if partial:
                continue
            raise ValueError(f"Missing measured source: {row['source']}")
        frames = engine.extract_row(row, config=CONFIG, source_dir=SOURCE_DIR)
        for column, (frame, details) in enumerate(frames):
            cell, record = engine.register_frame(frame, details, row["family"],
                                                  config=CONFIG, cell=CELL, anchor=ANCHOR)
            sheet.alpha_composite(cell, (column * CELL[0], row["runtime_row"] * CELL[1]))
            records.append({**record, "row": row["runtime_row"], "column": column,
                            "source_size": list(frame.size), "registered_bounds": list(cell.getbbox())})
    if not partial and len(records) != 108:
        raise ValueError("Expected exactly 108 authored frames")
    return sheet, records


def cell_at(sheet, row, col):
    return sheet.crop((col * CELL[0], row * CELL[1], (col + 1) * CELL[0], (row + 1) * CELL[1]))


def save_previews(sheet):
    contact = Image.new("RGB", (9 * 150 + 78, 18 * 177), "#576271")
    draw = ImageDraw.Draw(contact)
    for row in CONFIG["rows"]:
        y = row["runtime_row"] * 177
        draw.text((2, y + 70), f"row {row['runtime_row']}", fill="white")
        for col in range(row["frames"]):
            cell = cell_at(sheet, row["runtime_row"], col)
            contact.paste(cell, (78 + col * 150, y + 15), cell)
            draw.text((80 + col * 150, y), str(col), fill="white")
    engine.save_png(contact, CONTACT)
    preview = []
    for tick in range(18):
        canvas = Image.new("RGB", (6 * 150, 3 * 180), "#576271")
        draw = ImageDraw.Draw(canvas)
        for row in CONFIG["rows"]:
            index = row["runtime_row"]
            col = tick % row["frames"]
            cell = cell_at(sheet, index, col)
            x, y = (index % 6) * 150, (index // 6) * 180 + 17
            canvas.paste(cell, (x, y), cell)
            draw.text((x + 2, y - 15), f"row {index} frame {col}", fill="white")
        preview.append(canvas)
    preview[0].save(PREVIEW, save_all=True, append_images=preview[1:], duration=120,
                    loop=0, optimize=False, disposal=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--partial", action="store_true", help="Explicit incomplete preview while panels arrive")
    mode.add_argument("--write", action="store_true", help="Promote complete atlas to public/sprites/goku.png after QA")
    args = parser.parse_args()
    sheet, records = build_sheet(partial=args.partial)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    engine.save_png(sheet, OUTPUT)
    if args.write:
        engine.save_png(sheet, ROOT / "apps/client/public/sprites/goku.png")
    save_previews(sheet)
    missing = [r["runtime_row"] for r in CONFIG["rows"] if r["source"] not in CONFIG["sources"]]
    MEASUREMENTS.write_text(json.dumps({"complete": len(records) == 108, "missing_rows": missing,
                                      "sources": CONFIG["sources"], "frames": records}, indent=2) + "\n", encoding="utf-8")
    print(f"{len(records)}/108 authored frames; {sheet.size}; candidate: {OUTPUT}")
    print(f"Contact: {CONTACT}\nMotion: {PREVIEW}\nMissing rows: {missing}")


if __name__ == "__main__":
    main()
