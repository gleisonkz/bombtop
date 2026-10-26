"""Collect existing PixelLab jobs; never submit or bill a new generation."""
import argparse
import base64
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent


def token():
    value = os.environ.get("PIXELLAB_API_KEY")
    if not value:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value = winreg.QueryValueEx(key, "PIXELLAB_API_KEY")[0]
    return value


def collect(name, secret):
    job = json.loads((ROOT / f"api-{name}-job.json").read_text(encoding="utf-8-sig"))
    job_id = job.get("background_job_id") or job["background_job_ids"][0]
    request = urllib.request.Request(
        f"https://api.pixellab.ai/v2/background-jobs/{job_id}",
        headers={"Authorization": f"Bearer {secret}"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = json.load(response)
    (ROOT / f"api-{name}-status.json").write_text(json.dumps(data, indent=2) + "\n")
    result = data.get("last_response") or {}
    summary = {"name": name, "status": data["status"], "progress": result.get("progress")}
    if data["status"] == "completed":
        images = result.get("images") or [result.get("image")]
        out = ROOT / "api-generated" / name
        out.mkdir(parents=True, exist_ok=True)
        for index, image in enumerate(images):
            if image and image.get("base64"):
                encoded = image["base64"].split(",")[-1]
                (out / f"{index}.png").write_bytes(base64.b64decode(encoded))
        summary["images"] = len(list(out.glob("*.png")))
    elif data["status"] == "failed":
        summary["error"] = result.get("error")
    print(json.dumps(summary))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="+")
    args = parser.parse_args()
    secret = token()
    for name in args.names:
        collect(name, secret)
