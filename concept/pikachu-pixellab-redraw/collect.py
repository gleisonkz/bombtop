"""Download completed PixelLab MCP raw-image jobs without submitting generation."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parent


def download_frame(item):
    name, job, index = item
    target = ROOT / "generated" / name / f"{index:02}.png"
    if target.exists():
        return
    url = f"https://api.pixellab.ai/mcp/images/{job}/download?index={index}"
    download_url(url, target)


def download_url(url, target):
    if target.exists():
        return
    with urlopen(url, timeout=90) as response:
        data = response.read()
    image = Image.open(io.BytesIO(data))
    image.load()
    if image.mode != "RGBA":
        raise ValueError(f"{target}: expected RGBA, got {image.mode}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="*")
    parser.add_argument("--cast-fixes", action="store_true")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "jobs.json").read_text())
    jobs = manifest["jobs"]
    if args.cast_fixes:
        for index, job in manifest["cast_north_paw_fixes"].items():
            download_url(f"https://api.pixellab.ai/mcp/images/{job}/download",
                         ROOT / "corrections" / f"cast-north-{index}.png")
    tasks = []
    for name in args.names:
        action = name.split("-")[0]
        count = {"idle": 5, "walk": 7, "stun": 7, "death": 7,
                 "lobby": 9, "cast": 9, "carryIdle": 5, "carryWalk": 7}[action]
        tasks.extend((name, jobs[name], index) for index in range(count))
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(download_frame, tasks))
    for name in args.names:
        print(f"{name}: {len(list((ROOT / 'generated' / name).glob('*.png')))} frames")


if __name__ == "__main__":
    main()
