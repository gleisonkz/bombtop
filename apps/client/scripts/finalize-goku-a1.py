"""Register A1 sockets and the drawn SSJ1 sequence; never alter source artwork."""
import argparse
import hashlib
import json
import math
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/goku/a1-redraw"
CLIENT = ROOT / "apps/client"
OUT = ROOT / ".agent/goku-a1-packer"
CELL = (132, 164)
ANCHOR = (66, 150)
PLAYBACK = list(range(27)) + [26] * 6 + list(range(25, -1, -1)) + [0]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def selected_sources(filename):
    records = {}
    for job in read(ART / filename):
        for index, pose in enumerate(job["poses"]):
            selected = job.get("overrides", {}).get(pose, {})
            job_id = selected.get("job_id", job["job_id"])
            source = ART / "outputs" / job_id / f"{selected.get('index', index):02d}.png"
            raw = ART / "raw" / f"{pose}.png"
            if not source.exists() or source.read_bytes() != raw.read_bytes():
                raise ValueError(f"{pose}: selected job not collected, or native pixels changed")
            records[pose] = hashlib.sha256(raw.read_bytes()).hexdigest()
    return records


def palm(frame, side):
    points = {k["label"]: k for k in frame}
    wrist, elbow = points[f"{side} ARM"], points[f"{side} ELBOW"]
    x, y = wrist["x"] * 128, wrist["y"] * 160
    dx, dy = x - elbow["x"] * 128, y - elbow["y"] * 160
    norm = math.hypot(dx, dy)
    return [round(x + 2 + 2 * dx / norm, 3), round(y + 2 + 2 * dy / norm, 3)]


def derive():
    hashes = selected_sources("jobs.json")
    hashes.update(selected_sources("morph-jobs.json"))
    jobs = {j["row"]: j for j in read(ART / "jobs.json")}
    palms = {"frameW": CELL[0], "frameH": CELL[1], "rows": {}}
    for row in range(11, 17):
        request = jobs[row].get("request", f"requests/row{row:02d}.json")
        frames = read(ART / request)["keypoints"]
        sides = ("RIGHT",) if row in (12, 15) else ("RIGHT", "LEFT")
        palms["rows"][str(row)] = [[palm(frame, side) for side in sides] for frame in frames]
    write(ART / "native-palms.json", palms)
    charge, muzzle = {}, {}
    for direction, row in (("down", 8), ("side", 9), ("up", 10)):
        frames = read(ART / f"requests/row{row:02d}.json")["keypoints"]
        centers = []
        for frame in frames:
            hands = [palm(frame, side) for side in ("RIGHT", "LEFT")]
            centers.append([round(sum(p[i] for p in hands) / 2, 3) for i in range(2)])
        charge[direction] = centers[:5]
        release = [palm(frames[-1], side) for side in ("RIGHT", "LEFT")]
        leading = max(release, key=lambda p: p[0]) if direction == "side" else centers[-1]
        muzzle[direction] = [round(leading[i] - ANCHOR[i], 3) for i in range(2)]
    poses = []
    for index in range(27):
        image = Image.open(ART / "raw" / f"morph-c{index:02d}.png").convert("RGBA")
        if image.size != (128, 160):
            raise ValueError("Unexpected native transformation canvas")
        cell = Image.new("RGBA", CELL)
        cell.paste(image, (2, 2))
        poses.append(cell)
    lobby = Image.new("RGBA", (CELL[0] * len(PLAYBACK), CELL[1]))
    for index, pose in enumerate(PLAYBACK):
        lobby.paste(poses[pose], (index * CELL[0], 0))
    OUT.mkdir(exist_ok=True, parents=True)
    lobby.save(OUT / "lobby-candidate.png")
    preview = []
    for index in PLAYBACK:
        background = Image.new("RGB", CELL, "#465160")
        background.paste(poses[index], (0, 0), poses[index])
        preview.append(background.resize((264, 328), Image.Resampling.NEAREST))
    preview[0].save(OUT / "transform-preview.gif", save_all=True, append_images=preview[1:],
                    duration=50, loop=0, disposal=2)
    bounds = [p.getbbox() for p in poses]
    first = Image.open(ART / "raw/r00-c00.png").convert("RGBA")
    neck = read(ART / "retargeted/r00-c00.json")
    neck_y = next(k["y"] * 160 for k in neck if k["label"] == "NECK")
    head_box = first.crop((0, 0, 128, math.ceil(neck_y))).getbbox()
    left, top, right, bottom = head_box
    metadata = {"cell": list(CELL), "anchor": list(ANCHOR), "bodyH": 104,
                "scale": 22 / 104, "menuBodyH": 104,
                "portraitCrop": [max(0, left), max(0, top), right - left + 4, bottom - top + 4],
                "muzzle": muzzle, "charge": charge, "lobbyFrames": len(PLAYBACK),
                "lobbySize": list(lobby.size), "lobbyPlayback": PLAYBACK,
                "horizontalBounds": [min(b[0] for b in bounds), max(b[2] for b in bounds)],
                "source_sha256": hashes, "effects": False,
                "drawn_transform_poses": len({p.tobytes() for p in poses}),
                "generated_transform_frames": 27, "explicit_idle_holds": 3, "lobbyTicksPerFrame": 3,
                "lobby_sha256": hashlib.sha256((OUT / "lobby-candidate.png").read_bytes()).hexdigest()}
    write(ART / "runtime-metadata.json", metadata)
    return metadata


def promote(metadata):
    report = read(OUT / "report.json")
    if report["occupied"] != 108:
        raise ValueError("Gameplay atlas incomplete")
    if hashlib.sha256((ART / "jobs.json").read_bytes()).hexdigest() != report["jobs_sha256"]:
        raise ValueError("Selected gameplay jobs changed after packing")
    for frame in report["frames"]:
        if frame["sha256"] != metadata["source_sha256"][frame["pose"]]:
            raise ValueError("Gameplay candidate does not match selected native outputs")
    shutil.copyfile(OUT / "candidate.png", CLIENT / "public/sprites/goku.png")
    shutil.copyfile(OUT / "lobby-candidate.png", CLIENT / "public/sprites/goku-lobby.png")
    path = CLIENT / "src/render/sprites.ts"
    source = path.read_text(encoding="utf-8")
    start = source.index("  goku: {")
    end = source.index("\n  },", start) + len("\n  },")
    block = source[start:end]
    values = {"width": 1188, "height": 2952, "frameW": 132, "frameH": 164,
              "anchorX": 66, "anchorY": 150, "bodyH": 104, "scale": round(metadata["scale"], 8)}
    for key, value in values.items():
        block = re.sub(rf"(?m)^    {key}: [^,]+,", f"    {key}: {value},", block)
    block = re.sub(r'url: "sprites/goku.png[^\"]*"', 'url: "sprites/goku.png?v=a1-skeleton-20261026"', block)
    lobby = (f'    lobby: {{ row: 0, frames: 60, image: {{ url: "sprites/goku-lobby.png?v=a1-ssj1-{metadata["lobby_sha256"][:12]}", '
             f'width: 7920, height: 164, frameW: 132, frameH: 164, anchorX: 66, anchorY: 150, ticksPerFrame: 3 }} }},')
    block = re.sub(r"(?m)^    lobby: .*", lobby, block)
    muzzle = ", ".join(f"{key}: {json.dumps(value)}" for key, value in metadata["muzzle"].items())
    block = re.sub(r"(?m)^    muzzle: .*", "    muzzle: { " + muzzle + " },", block)
    block = re.sub(r"(?m)^    hueBase: .*", "    hueBase: [36, 56, 114],", block)
    source = source[:start] + block + source[end:]
    start = source.index("const KAME_CHARGE_HANDS = {")
    end = source.index("} as const;", start) + len("} as const;")
    source = source[:start] + "const KAME_CHARGE_HANDS = {\n" + "".join(
        f"  {key}: {json.dumps(value)},\n" for key, value in metadata["charge"].items()) + "} as const;" + source[end:]
    path.write_text(source, encoding="utf-8")
    path = CLIENT / "src/render/score-portraits.json"
    profiles = read(path)
    profiles["goku"].update(frame=list(CELL), crop=metadata["portraitCrop"])
    profiles["goku"].pop("outline", None)
    write(path, profiles)
    path = CLIENT / "src/ui/cast-animation-bounds.json"
    source = path.read_text(encoding="utf-8")
    source = re.sub(r'("goku":\s*)\[[^\]]+\]', lambda m: m[1] + json.dumps(metadata["horizontalBounds"]), source)
    path.write_text(source, encoding="utf-8")
    path = CLIENT / "src/ui/cast-layout.ts"
    path.write_text(re.sub(r"goku: \d+,", "goku: 104,", path.read_text(encoding="utf-8"), count=1), encoding="utf-8")
    path = CLIENT / "scripts/build-carry-anchors.py"
    source = path.read_text(encoding="utf-8").replace("concept/goku/approved-taller/palms.json", "concept/goku/a1-redraw/native-palms.json")
    path.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    metadata = derive()
    if args.promote:
        promote(metadata)
    print("Goku A1: 108 gameplay cells; 27 drawn transformation poses, 60 playback frames at 20fps; no source image edits")
