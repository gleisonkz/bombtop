"""Download already submitted masked-eye jobs; never create generations."""
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
import urllib.error
import urllib.request

from PIL import Image

ROOT = Path(__file__).resolve().parent


def collect(entry):
    path = ROOT / "results" / f"{entry['name']}.png"
    if path.exists():
        return "cached"
    url = f"https://api.pixellab.ai/mcp/images/{entry['job_id']}/download"
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        return f"pending/http-{error.code}:{entry['name']}"
    with Image.open(io.BytesIO(raw)) as image:
        if image.size != (288, 192):
            raise ValueError(f"{entry['name']}: unexpected inpaint canvas {image.size}")
    path.write_bytes(raw)
    return "completed"


if __name__ == "__main__":
    (ROOT / "results").mkdir(exist_ok=True)
    jobs = json.loads((ROOT / "jobs.json").read_text(encoding="utf-8-sig"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        states = list(pool.map(collect, jobs))
    print(json.dumps({state: states.count(state) for state in sorted(set(states))}))
