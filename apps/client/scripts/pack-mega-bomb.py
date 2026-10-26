"""Pack four mega stages; the approved original remains the armed source."""
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "concept/bombs/mega-bomber.png"
STAGE_SOURCE = ROOT / "concept/bombs/mega-stages.png"
OUTPUT = ROOT / "apps/client/public/sprites/bombs/mega"
SIZE = 512
STAGES = ("armed", "warning", "critical", "detonation-start")


def validate_source(image: Image.Image, expected_size=None) -> None:
    if image.mode != "RGBA" or image.width != image.height:
        raise ValueError("Mega bomb source must be square RGBA")
    if expected_size is not None and image.size != expected_size:
        raise ValueError(f"Mega stage source must be {expected_size}, got {image.size}")
    if image.getchannel("A").getextrema() != (0, 255):
        raise ValueError("Mega bomb source needs transparent and opaque pixels")


def white_flash(image: Image.Image) -> Image.Image:
    flash = Image.new("RGBA", image.size, (255, 255, 255, 255))
    flash.putalpha(image.getchannel("A"))
    return flash


def build_stages(original: Image.Image, sheet: Image.Image) -> dict[str, Image.Image]:
    validate_source(original)
    validate_source(sheet, (SIZE * 2, SIZE * 2))
    stages = {"armed": original.resize((SIZE, SIZE), Image.Resampling.LANCZOS)}
    for index, stage in enumerate(STAGES[1:], start=1):
        x, y = index % 2 * SIZE, index // 2 * SIZE
        cell = sheet.crop((x, y, x + SIZE, y + SIZE))
        validate_source(cell, (SIZE, SIZE))
        stages[stage] = cell
    if len({image.tobytes() for image in stages.values()}) != len(STAGES):
        raise ValueError("Mega bomb stages must contain four distinct images")
    return stages


def export_stages(stages: dict[str, Image.Image], output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for stage, image in stages.items():
        image.save(output / f"{stage}.png")
        white_flash(image).save(output / f"{stage}-white.png")


def main():
    with Image.open(SOURCE) as source, Image.open(STAGE_SOURCE) as sheet:
        stages = build_stages(source, sheet)
    export_stages(stages, OUTPUT)
    print(f"Exported {OUTPUT.relative_to(ROOT)} (8 x 512 x 512 RGBA)")


if __name__ == "__main__":
    main()
