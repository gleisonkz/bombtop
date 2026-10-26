"""Download the recorded PixelLab jobs without creating new generations."""
import base64
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent


def request(path, secret):
    req = urllib.request.Request("https://api.pixellab.ai/v2/" + path,
                                 headers={"Authorization": "Bearer " + secret})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def collect(item, secret):
    name, entry = item
    data = request("background-jobs/" + entry["job_id"], secret)
    directory = ROOT / "status"
    directory.mkdir(exist_ok=True)
    (directory / (name + ".json")).write_text(json.dumps(data) + "\n")
    result = data.get("last_response") or {}
    if data["status"] == "completed":
        out = ROOT / "generated" / name
        out.mkdir(parents=True, exist_ok=True)
        for index, image in enumerate(result.get("images", [])):
            (out / f"frame_{index:03}.png").write_bytes(base64.b64decode(image["base64"].split(",")[-1]))
        return {"clip": name, "status": "completed", "frames": len(result.get("images", []))}
    return {"clip": name, "status": data["status"], "progress": result.get("progress"),
            "error": result.get("error")}


def main():
    secret = os.environ.get("PIXELLAB_API_KEY")
    if not secret:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            secret = winreg.QueryValueEx(key, "PIXELLAB_API_KEY")[0]
    ledger = json.loads((ROOT / "submitted.json").read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda item: collect(item, secret), ledger["clips"].items()))
    for result in results:
        print(json.dumps(result))
    for label, character in (("rotations", ledger["character_id"]),
                             ("carry-rotations", ledger.get("carry_character_id"))):
        if not character:
            continue
        data = request("characters/" + character, secret)
        (ROOT / (label + ".json")).write_text(json.dumps(data, indent=2) + "\n")
        print(label, data.get("status"))


if __name__ == "__main__":
    main()
