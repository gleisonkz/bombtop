"""Collect recorded PixelLab reskin jobs without starting new generations."""
import base64
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
from pathlib import Path
import urllib.request

from PIL import Image

ROOT = Path(__file__).resolve().parent


def collect(entry, secret):
    output = ROOT / "generated"
    output.mkdir(exist_ok=True)
    if all((output / f"{pose}.png").exists() for pose in entry["poses"]):
        return {"job": entry["job_id"], "status": "cached"}
    request = urllib.request.Request(
        "https://api.pixellab.ai/v2/background-jobs/" + entry["job_id"],
        headers={"Authorization": "Bearer " + secret})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.load(response)
    result = data.get("last_response") or {}
    images = result.pop("images", [])
    if data["status"] == "completed":
        if len(images) != len(entry["poses"]):
            raise ValueError(f"{entry['job_id']}: frame count differs from requested poses")
        for pose, encoded in zip(entry["poses"], images):
            raw = base64.b64decode(encoded["base64"].split(",")[-1])
            with Image.open(io.BytesIO(raw)) as image:
                if image.mode != "RGBA" or image.size != (132, 164):
                    raise ValueError(f"{pose}: invalid generated canvas {image.mode} {image.size}")
            (output / f"{pose}.png").write_bytes(raw)
    status = ROOT / "status"
    status.mkdir(exist_ok=True)
    (status / f"{entry['job_id']}.json").write_text(json.dumps(data, indent=2) + "\n")
    return {"job": entry["job_id"], "status": data["status"],
            "progress": result.get("progress"), "error": result.get("error")}


def main():
    secret = os.environ.get("PIXELLAB_API_KEY")
    if not secret:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            secret = winreg.QueryValueEx(key, "PIXELLAB_API_KEY")[0]
    entries = json.loads((ROOT / "jobs.json").read_text(encoding="utf-8-sig"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda entry: collect(entry, secret), entries))
    print(json.dumps({state: sum(item["status"] == state for item in results)
                      for state in sorted({item["status"] for item in results})}))
    for item in results:
        if item["status"] == "failed":
            print(json.dumps(item))


if __name__ == "__main__":
    main()
