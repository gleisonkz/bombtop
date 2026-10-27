"""Download selected native PixelLab outputs. No generation or art changes."""
import concurrent.futures
import io
import json
import shutil
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent


def collect(item):
    pose, job, index = item
    source = ROOT / "outputs" / job / f"{index:02d}.png"
    try:
        if not source.exists():
            url = f"https://api.pixellab.ai/mcp/images/{job}/download?index={index}"
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read()
            with Image.open(io.BytesIO(data)) as image:
                if image.mode != "RGBA" or image.size != (128, 160):
                    raise ValueError(f"{pose}: unexpected native canvas {image.size}/{image.mode}")
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(data)
        target = ROOT / "raw" / f"{pose}.png"
        target.parent.mkdir(exist_ok=True)
        shutil.copyfile(source, target)
        return pose, "ok"
    except (urllib.error.URLError, ValueError) as exc:
        return pose, str(exc)


def main():
    jobs = json.loads((ROOT / "jobs.json").read_text(encoding="utf-8-sig"))
    if (ROOT / "lobby-jobs.json").exists():
        jobs += json.loads((ROOT / "lobby-jobs.json").read_text(encoding="utf-8-sig"))
    if (ROOT / "fluid-jobs.json").exists():
        jobs += json.loads((ROOT / "fluid-jobs.json").read_text(encoding="utf-8-sig"))
    if (ROOT / "morph-jobs.json").exists():
        jobs += json.loads((ROOT / "morph-jobs.json").read_text(encoding="utf-8-sig"))
    items = []
    for job in jobs:
        for index, pose in enumerate(job["poses"]):
            selected = job.get("overrides", {}).get(pose, {})
            items.append((pose, selected.get("job_id", job["job_id"]), selected.get("index", index)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(collect, items))
    failed = [(pose, error) for pose, error in results if error != "ok"]
    print(f"Downloaded {len(results) - len(failed)}/{len(results)} selected frames")
    for pose, error in failed[:12]:
        print(pose, error)


if __name__ == "__main__":
    main()
