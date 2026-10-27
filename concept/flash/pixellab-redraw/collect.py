"""Download the existing Flash jobs without submitting new generations."""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parent


def get(url, secret):
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {secret}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="*")
    parser.add_argument("--rotations", action="store_true")
    args = parser.parse_args()
    secret = os.environ.get("PIXELLAB_API_KEY")
    if not secret:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            secret = winreg.QueryValueEx(key, "PIXELLAB_API_KEY")[0]
    jobs = json.loads((ROOT / "jobs.json").read_text())
    if args.rotations:
        data = get(f"https://api.pixellab.ai/v2/characters/{jobs['character_id']}", secret)
        (ROOT / "character.json").write_text(json.dumps(data, indent=2) + "\n")
        for direction, url in (data.get("rotation_urls") or {}).items():
            if not url:
                continue
            out = ROOT / "rotations" / f"{direction}.png"
            out.parent.mkdir(exist_ok=True)
            subprocess.run(["curl.exe", "--fail", "--silent", "--show-error", "--location",
                            "--output", str(out), url], check=True)
        print(json.dumps({"character": data.get("status"), "rotations": list(data.get("rotation_urls") or {})}))
    for name in args.names or ([] if args.rotations else jobs["jobs"]):
        job = jobs["jobs"][name]
        status_path = ROOT / f"status-{name}.json"
        data = json.loads(status_path.read_text()) if status_path.exists() else {}
        if data.get("status") != "completed":
            data = get(f"https://api.pixellab.ai/v2/background-jobs/{job['id']}", secret)
            status_path.write_text(json.dumps(data, indent=2) + "\n")
        response = data.get("last_response") or {}
        summary = {"name": name, "status": data.get("status"), "progress": response.get("progress")}
        if data.get("status") == "completed":
            images = response.get("images") or []
            out = ROOT / "frames" / name
            out.mkdir(parents=True, exist_ok=True)
            for index, image in enumerate(images):
                path = out / f"{index}.png"
                if not path.exists():
                    path.write_bytes(base64.b64decode(image["base64"].split(",")[-1]))
            summary["frames"] = len(images)
        if data.get("status") == "failed":
            summary["error"] = response.get("error")
        print(json.dumps(summary))


if __name__ == "__main__":
    main()

