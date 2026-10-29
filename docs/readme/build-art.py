"""Compose README artwork from the game's real logo and first idle frames.

Run from the repository root: python docs/readme/build-art.py
Requires Pillow; this is presentation artwork, not a gameplay screenshot.
"""
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
FONT = Path("C:/Windows/Fonts/arialbd.ttf")


def font(size):
    if FONT.exists():
        return ImageFont.truetype(str(FONT), size)
    return ImageFont.truetype("DejaVuSans-Bold.ttf", size)


def background(width, height):
    image = Image.new("RGB", (width, height), "#14142b")
    draw = ImageDraw.Draw(image)
    for x in range(0, width, 40):
        draw.line((x, 0, x, height), fill="#1c1d38")
    for y in range(0, height, 40):
        draw.line((0, y, width, y), fill="#1c1d38")
    draw.rectangle((0, 0, width, 5), fill="#ffcf32")
    draw.rectangle((0, height - 6, width, height), fill="#40c7ff")
    return image


def main():
    source = (ROOT / "apps/client/src/render/sprites.ts").read_text(encoding="utf-8")
    names = {
        "bomber": "Bomber", "captain": "Capitão América", "thor": "Thor",
        "goku": "Goku", "naruto": "Naruto", "spider": "Homem-Aranha",
        "pikachu": "Pikachu", "static": "Super Choque", "flash": "Flash",
        "bugs": "Pernalonga", "lantern": "Lanterna Verde", "donatello": "Donatello",
        "penelope": "Penélope", "panther": "Pantera Rosa", "harry": "Harry Potter",
        "optimus": "Optimus Prime", "pele": "Pelé", "lula": "Lula",
    }
    entries = []
    for key, label in names.items():
        match = re.search(r"^  " + key + r": \{(.*?)(?=^  \},)", source, re.M | re.S)
        if match is None:
            raise ValueError(f"Missing sheet: {key}")
        block = match.group(1)
        url = re.search(r'url: "([^"]+)"', block).group(1).split("?")[0]
        width = int(re.search(r"frameW: (\d+)", block).group(1))
        height = int(re.search(r"frameH: (\d+)", block).group(1))
        with Image.open(ROOT / "apps/client/public" / url) as sheet:
            sprite = sheet.convert("RGBA").crop((0, 0, width, height))
        bounds = sprite.getbbox()
        if bounds is None:
            raise ValueError(f"Empty first idle frame: {key}")
        entries.append((label, sprite.crop(bounds)))

    hero = background(1440, 740)
    draw = ImageDraw.Draw(hero)
    with Image.open(ROOT / "apps/client/public/branding/bomb-top-logo-v1.png") as source_logo:
        logo = source_logo.convert("RGBA")
    logo.thumbnail((820, 457), Image.Resampling.LANCZOS)
    hero.paste(logo, ((1440 - logo.width) // 2, 38), logo)
    draw.text((720, 524), "ACENDA O PAVIO. DOMINE A ARENA.", font=font(35), anchor="mm", fill="#ffda57")
    draw.text((720, 573), "PIXEL ART  /  ATÉ 5 JOGADORES  /  DIRETO NO NAVEGADOR", font=font(22), anchor="mm", fill="#d8e6fa")
    for index, x in zip([1, 3, 4, 6, 11], [480, 600, 720, 840, 960]):
        sprite = entries[index][1].copy()
        sprite.thumbnail((72, 92), Image.Resampling.NEAREST)
        hero.paste(sprite, (x - sprite.width // 2, 704 - sprite.height), sprite)
    hero.save(OUT / "hero.png", optimize=True)

    roster = background(1440, 650)
    draw = ImageDraw.Draw(roster)
    draw.text((44, 38), "ESCOLHA SEU PERSONAGEM", font=font(32), fill="#ffda57")
    draw.text((44, 85), "18 personagens. Poderes próprios. Uma arena para resolver tudo.", font=font(21), fill="#cad9ed")
    for index, (label, original) in enumerate(entries):
        x, y = 30 + (index % 9) * 154, 133 + (index // 9) * 246
        draw.rounded_rectangle((x, y, x + 144, y + 228), radius=12, fill="#20213e", outline="#3b4366", width=2)
        scale = min(110 / original.width, 159 / original.height)
        sprite = original.resize((round(original.width * scale), round(original.height * scale)), Image.Resampling.NEAREST)
        roster.paste(sprite, (x + 72 - sprite.width // 2, y + 181 - sprite.height), sprite)
        draw.text((x + 72, y + 204), label, font=font(15), anchor="mm", fill="#e7f4ff")
    roster.save(OUT / "roster.png", optimize=True)
    print(f"README artwork built from {len(entries)} character sheets.")


if __name__ == "__main__":
    main()

