"""Collect known PixelLab MCP frame URLs into a manifest's generated directory.

Does not submit new generations or require API credentials.
Manifest jobs map clip names to job UUIDs; optional frame_counts override totals.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

DEFAULT_TOTALS = {"idle": 5, "walk": 7, "stun": 7, "death": 7,
                  "cast": 9, "lobby": 9, "carryIdle": 5, "carryWalk": 7}


def collect_frame(task):
    target, job_id, index = task
    if target.is_file():
        return
    url = f"https://api.pixellab.ai/mcp/images/{job_id}/download?index={index}"
    with urlopen(url, timeout=90) as response:
        data = response.read()
    image = Image.open(io.BytesIO(data))
    image.load()
    if image.mode != "RGBA" or image.getchannel("A").getextrema()[0] != 0:
        raise ValueError(f"Expected RGBA with transparency: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("clips", nargs="+")
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    destination = manifest_path.parent / "generated"
    tasks = []
    for clip in args.clips:
        total = manifest.get("frame_counts", {}).get(clip)
        if total is None:
            total = DEFAULT_TOTALS[clip.split("-")[0]]
        tasks.extend((destination / clip / f"{index:02}.png", manifest["jobs"][clip], index)
                     for index in range(total))
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(collect_frame, tasks))
    for clip in args.clips:
        print(f"{clip}: {len(list((destination / clip).glob('*.png')))} downloaded frames")


if __name__ == "__main__":
    main()
