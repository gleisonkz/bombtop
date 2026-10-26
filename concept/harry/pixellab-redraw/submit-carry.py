"""Submit missing carry clips from the approved overhead poses, persisting each job."""
import base64
import json
from pathlib import Path
import urllib.request
import winreg

ROOT = Path(__file__).resolve().parent


def main():
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
        secret = winreg.QueryValueEx(key, "PIXELLAB_API_KEY")[0]
    path = ROOT / "jobs.json"
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    views = {"south": "Front view facing the camera.",
             "east": "Strict right side profile facing right; never turn.",
             "north": "Back view facing away; no face or eyes visible; never turn."}
    for direction, view in views.items():
        source = ROOT / "frames" / f"carry-pose-{direction}" / "0.png"
        for action, count in (("idle", 4), ("loop", 6)):
            name = f"carry-{action}-{direction}"
            if name in data["jobs"]:
                print(f"{name}: existing job retained")
                continue
            motion = ("Subtle breathing idle in this exact raised-arms pose. Feet planted, legs still."
                      if action == "idle" else
                      "Seamless walking-in-place loop, six alternating natural steps and gentle robe sway.")
            prompt = (view + " " + motion + " BOTH hands must stay ABOVE the head at fixed height in every frame, "
                      "palms UP, elbows bent naturally, both hands EMPTY. Preserve this exact Harry face, open eyes, "
                      "round glasses, hair, uniform, detail and native scale. No lowering the hands. "
                      "Character only, transparent background, locked camera. No wand, objects, balls, spheres, "
                      "bombs, magic, Patronus, glow, particles or shadows.")
            payload = {"first_frame": {"base64": base64.b64encode(source.read_bytes()).decode()},
                       "action": prompt, "frame_count": count, "no_background": True, "seed": 20261104}
            request = urllib.request.Request("https://api.pixellab.ai/v2/animate-with-text-v3",
                data=json.dumps(payload).encode(), method="POST",
                headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=90) as response:
                receipt = json.load(response)
            data["jobs"][name] = {"id": receipt["background_job_id"], "receipt": receipt,
                                  "source": str(source.relative_to(ROOT)), "action": prompt}
            path.write_text(json.dumps(data, indent=2) + "\n")
            print(f"{name}: {receipt['background_job_id']}")


if __name__ == "__main__":
    main()
