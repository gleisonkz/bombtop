"""Submit recorded Panther animations or collect them without duplicate billing."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent
IDENTITY = ("Keep this exact approved classic Pink Panther, VERY SLIM narrow waist and torso, "
            "long THIN arms and legs, long thin tail, small head, original yellow eyes and elongated muzzle. "
            "Preserve native detail, pink colors and proportions. Full figure and tail visible. "
            "Only character on transparent background. No scarf, clothes, props, balls, bombs, "
            "particles, smoke, aura, magic, ground shadows or effects. Locked camera. ")
DIRECTIONS = ["south", "east", "north"]


def secret():
    value = os.environ.get("PIXELLAB_API_KEY")
    if not value:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value = winreg.QueryValueEx(key, "PIXELLAB_API_KEY")[0]
    return value


def api(path, token, body=None):
    headers = {"Authorization": "Bearer " + token}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request("https://api.pixellab.ai/v2/" + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"PixelLab HTTP {error.code}: {error.read().decode()[:1800]}") from None


def write(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def submit(ledger, token, name, count, directions, action, start=None):
    missing = [direction for direction in directions if name + "-" + direction not in ledger["clips"]]
    if not missing:
        return
    body = {"character_id": ledger["character_id"], "mode": "v3", "frame_count": count,
            "directions": missing, "keep_first_frame": False, "animation_name": "Bombtop " + name,
            "action_description": IDENTITY + action, "seed": 20261026 + len(ledger["clips"])}
    if start:
        body["custom_start_frame"] = {"base64": base64.b64encode(start.read_bytes()).decode()}
    response = api("characters/animations", token, body)
    for direction, job in zip(missing, response["background_job_ids"]):
        ledger["clips"][name + "-" + direction] = {
            "job_id": job, "frames_requested": count, "action": action,
            "direction": direction, "animation_group_id": response.get("animation_group_id")}
    write(ROOT / "submitted.json", ledger)
    print(name, "submitted", ",".join(missing), flush=True)


def collect(item, token):
    name, entry = item
    status_path = ROOT / "status" / (name + ".json")
    data = api("background-jobs/" + entry["job_id"], token)
    result = data.get("last_response") or {}
    images = result.pop("images", [])
    if data["status"] == "completed":
        directory = ROOT / "generated" / name
        directory.mkdir(parents=True, exist_ok=True)
        for index, image in enumerate(images):
            (directory / f"frame_{index:03}.png").write_bytes(
                base64.b64decode(image["base64"].split(",")[-1]))
    status_path.parent.mkdir(exist_ok=True)
    write(status_path, data)
    return {"clip": name, "status": data["status"], "frames": len(images),
            "progress": result.get("progress"), "error": result.get("error")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["submit-base", "collect", "submit-idle"])
    args = parser.parse_args()
    token = secret()
    ledger = json.loads((ROOT / "submitted.json").read_text())
    if args.action == "submit-base":
        character = api("characters/" + ledger["character_id"], token)
        if character["status"] != "completed":
            raise SystemExit("Character rotations not ready; no jobs submitted.")
        write(ROOT / "character.json", character)
        submit(ledger, token, "idle", 4, DIRECTIONS,
               "Subtle breathing idle loop. Relaxed standing, both feet planted, arms at sides, tail gently sways. Do not walk or turn.")
        submit(ledger, token, "walk", 6, DIRECTIONS,
               "Smooth six-phase walking IN PLACE loop with clear alternating long slender legs and natural opposing arms. Keep original facing throughout. No running or turning.")
        submit(ledger, token, "stun", 6, ["south"],
               "Short hurt reaction: recoil slightly with surprised face and hands close to chest, then recover to original upright idle. Keep feet near same spot. No stars or impact effects.")
        submit(ledger, token, "death", 8, ["south"],
               "Comic defeat: wobble, bend knees, fall backwards gently and end lying on back on the ground. Long slim figure and tail stay connected. No stars, ghosts, symbols or effects.")
        submit(ledger, token, "sneak", 6, DIRECTIONS,
               "Classic Pink Panther stealth TIPTOE walk in place. Slightly crouched thin torso, bent knees, raised heels, paws delicately held before chest, sly face. Alternate feet quietly. Stay fully visible and opaque. Never disappear. Maintain original facing and same slim body.")
        submit(ledger, token, "carry-walk", 14, DIRECTIONS,
               "Immediately lift BOTH EMPTY hands overhead with palms facing UP. Then keep both hands ABOVE head throughout remaining clip while walking IN PLACE in a smooth alternating stride. Natural connected shoulders elbows wrists and delicate pink paws. Empty hands support nothing visible. Keep original facing. Do not draw an object or sphere.")
        submit(ledger, token, "lobby", 14, ["south"],
               "Classic sly introduction: take two delicate tiptoe steps in place, turn head slightly toward viewer, raise one index finger gently to mouth in a shushing gesture, give a knowing half-lidded look, lower hand and return to relaxed pose. Slim long graceful limbs and tail. Stay near center. No letters or effects.")
    elif args.action == "submit-idle":
        for direction in DIRECTIONS:
            start = ROOT / "generated" / ("carry-walk-" + direction) / "frame_010.png"
            if not start.exists():
                print("carry-idle", direction, "waiting for walking source", flush=True)
                continue
            submit(ledger, token, "carry-idle", 4, [direction],
                   "Subtle breathing idle holding this EXACT overhead-arms pose, both EMPTY pink palms UP above head. Feet planted and legs stationary. Hands remain raised at fixed height, no walking, turning or lowering arms. Small chest breathing only.", start)
    else:
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda item: collect(item, token), ledger["clips"].items()))
        for result in results:
            print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
