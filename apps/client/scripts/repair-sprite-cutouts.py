"""Apply reviewed pixel repairs without changing frame geometry or source drawings."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

CLIENT = Path(__file__).resolve().parents[1]
MANIFEST = Path(__file__).with_name('sprite-cutout-patches.json')


def repaired_asset(asset):
    path = CLIENT / 'public/sprites' / asset['file']
    with Image.open(path) as source:
        image = source.convert('RGBA')
    if list(image.size) != asset['size']:
        raise ValueError(f"Geometry changed: {path}")
    fingerprint = hashlib.sha256(image.tobytes()).hexdigest()
    if fingerprint == asset['repairedPixelsSha256']:
        return path, image, False
    if fingerprint != asset['sourcePixelsSha256']:
        raise ValueError(f"Source changed; review repairs before applying: {path}")
    for x, y, before, after in asset['changes']:
        if list(image.getpixel((x, y))) != before:
            raise ValueError(f"Pixel changed: {path} at {(x, y)}")
        image.putpixel((x, y), tuple(after))
    if hashlib.sha256(image.tobytes()).hexdigest() != asset['repairedPixelsSha256']:
        raise ValueError(f"Unexpected repair result: {path}")
    return path, image, True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Apply reviewed repairs; default checks current assets')
    args = parser.parse_args()
    assets = json.loads(MANIFEST.read_text(encoding='utf-8'))['assets']
    prepared = [repaired_asset(asset) for asset in assets]
    if not args.write and any(changed for _, _, changed in prepared):
        raise SystemExit('Sprite cutout repairs are missing; run with --write after reviewing the manifest')
    for path, image, changed in prepared:
        if args.write and changed:
            image.save(path, optimize=True)
        print(f'{path.name}: reviewed cutout pixels verified')


if __name__ == '__main__':
    main()
