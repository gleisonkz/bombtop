from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "public" / "icons"
SOURCE = ICONS / "touch-actions-atlas.png"
REGIONS = {
    "stop": (138, 204),
    "brace": (214, 274),
    "action": (284, 355),
    "bomb": (367, 430),
    "special": (436, 503),
}


def main():
    source = Image.open(SOURCE).convert("RGBA")
    for name, (left, right) in REGIONS.items():
        region = source.crop((left, 0, right, source.height))
        art = region.crop(region.getbbox())
        icon = Image.new("RGBA", (96, 96))
        icon.alpha_composite(art, ((96 - art.width) // 2, (96 - art.height) // 2))
        icon.save(ICONS / f"touch-{name}.png", optimize=True)


if __name__ == "__main__":
    main()
