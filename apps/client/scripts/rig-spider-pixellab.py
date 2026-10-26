"""Conventional cutout animation of existing PixelLab pixels using Pillow.

No image model or network access. Source exports stay immutable. Cropped costume
parts, integer translations and nearest-neighbor transforms form the new poses.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/spider/pixellab"
OUT = ART / "rigged"
SIZE = (96, 96)
ARM_INK = (0, 0, 0, 255)
ARM_RED = (203, 42, 42, 255)
ARM_SHADOW = (116, 17, 43, 255)
ARM_BLUE = (40, 74, 111, 255)
ARM_NAVY = (25, 37, 77, 255)


def blank():
    return Image.new("RGBA", SIZE)


def load(path):
    return Image.open(ART / path).convert("RGBA")


def source_frames(animations, prefix, direction):
    groups = [value[direction] for key, value in animations.items()
              if key.startswith(prefix) and direction in value]
    if len(groups) != 1:
        raise ValueError(f"Ambiguous source: {prefix}/{direction}")
    return ["export/" + path for path in groups[0]]


def head_box(image):
    box = image.getchannel("A").getbbox()
    region = image.crop((0, box[1], 96, box[1] + 30)).getchannel("A").getbbox()
    return [region[0], box[1], region[2], box[1] + 30]


def clean_body(source, direction):
    body = source.copy()
    draw = ImageDraw.Draw(body)
    if direction in ("south", "north"):
        draw.rectangle((0, 50, 34, 69), fill=(0, 0, 0, 0))
        draw.rectangle((61, 50, 95, 69), fill=(0, 0, 0, 0))
    else:
        draw.rectangle((55, 54, 61, 69), fill=(0, 0, 0, 0))
        for y in range(54, 70):
            blue = [(x, source.getpixel((x, y))) for x in range(40, 54)
                    if source.getpixel((x, y))[3] > 128
                    and source.getpixel((x, y))[2] > source.getpixel((x, y))[0] * 1.15]
            if not blue:
                continue
            for x in range(49, 55):
                r, g, b, a = source.getpixel((x, y))
                if a and r > b * 1.15 and r > g * 1.2:
                    body.putpixel((x, y), min(blue, key=lambda item: abs(item[0] - x))[1])
    return body


def placed(part, position, angle=0, pivot=None):
    result = blank()
    result.alpha_composite(part, position)
    if angle:
        result = result.rotate(angle, Image.Resampling.NEAREST, center=pivot)
    return result


def overlay(parts):
    result = blank()
    for part in parts:
        result.alpha_composite(part)
    return result


def shifted(image, delta):
    result = blank()
    result.alpha_composite(image, delta)
    return result


def draw_limb(canvas, shoulder, elbow, wrist):
    draw = ImageDraw.Draw(canvas)
    points = [tuple(shoulder), tuple(elbow), tuple(wrist)]
    draw.line(points, fill=ARM_INK, width=9, joint="curve")
    for x, y in points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=ARM_INK)
    draw.line(points, fill=ARM_RED, width=6, joint="curve")
    for x, y in points:
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=ARM_RED)
    sleeve = (round(shoulder[0] + (elbow[0] - shoulder[0]) * 0.48),
              round(shoulder[1] + (elbow[1] - shoulder[1]) * 0.48))
    draw.line([tuple(shoulder), sleeve], fill=ARM_BLUE, width=6)
    draw.line([tuple(elbow), tuple(wrist)], fill=ARM_SHADOW, width=1)


def carry_arms(left_glove, right_glove, direction):
    if direction == "east":
        poses = [
            {"shoulder": [43, 51], "elbow": [34, 39], "wrist": [37, 23],
             "glove": left_glove, "glove_at": (32, 12), "palm": [37, 20]},
            {"shoulder": [58, 51], "elbow": [70, 39], "wrist": [68, 23],
             "glove": right_glove, "glove_at": (63, 12), "palm": [68, 20]},
        ]
    else:
        poses = [
            {"shoulder": [37, 51], "elbow": [25, 39], "wrist": [30, 23],
             "glove": left_glove, "glove_at": (25, 12), "palm": [30, 20]},
            {"shoulder": [59, 51], "elbow": [71, 39], "wrist": [65, 23],
             "glove": right_glove, "glove_at": (60, 12), "palm": [65, 20]},
        ]
    result = blank()
    for pose in poses:
        draw_limb(result, pose["shoulder"], pose["elbow"], pose["wrist"])
        result.alpha_composite(pose["glove"].resize((10, 10), Image.Resampling.NEAREST),
                               pose["glove_at"])
    palms = [pose["palm"] for pose in poses] if direction != "east" else [poses[1]["palm"]]
    joints = [{key: pose[key] for key in ("shoulder", "elbow", "wrist")} for pose in poses]
    return result, palms, joints


def save_frame(image, action, direction, index):
    path = OUT / action / direction / f"{index}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return path.relative_to(ART).as_posix()


def build_carry(animations, gloves):
    actions, sources = {}, set()
    for action, prefix in (("carry-idle", "Breathing_Idle"), ("carry-walk", "Walking")):
        actions[action] = {}
        for direction in ("south", "east", "north"):
            paths = source_frames(animations, prefix, direction)
            first_head = head_box(load(paths[0]))
            arms, palms, joints = carry_arms(*gloves, direction)
            frames = []
            for index, path in enumerate(paths):
                sources.add(path)
                source = load(path)
                head = head_box(source)
                dx = round((head[0] + head[2] - first_head[0] - first_head[2]) / 2)
                dy = head[1] - first_head[1]
                result = overlay([shifted(arms, (dx, dy)), clean_body(source, direction)])
                grips = [[x + dx, y + dy] for x, y in palms]
                limbs = [{key: [point[0] + dx, point[1] + dy]
                          for key, point in joint.items()} for joint in joints]
                frames.append({"path": save_frame(result, action, direction, index),
                               "source": path, "head": head, "palms": grips,
                               "limbs": limbs})
            actions[action][direction] = frames
    return actions, sources


def front_parts(base):
    head = head_box(base)
    return {
        "head": base.crop((head[0], head[1] - 2, head[2], head[3])),
        "head_at": (head[0], head[1] - 2),
        "torso": base.crop((35, 45, 61, 64)),
        "left_leg": base.crop((32, 61, 48, 79)),
        "right_leg": base.crop((48, 61, 65, 79)),
        "left_arm": base.crop((26, 44, 39, 69)),
        "right_arm": base.crop((59, 44, 71, 69)),
    }


def articulated_leg(hip, knee, ankle, side):
    canvas = blank()
    draw = ImageDraw.Draw(canvas)
    points = [tuple(hip), tuple(knee), tuple(ankle)]
    draw.line(points, fill=ARM_INK, width=10, joint="curve")
    for x, y in points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=ARM_INK)
    draw.line(points, fill=ARM_BLUE, width=7, joint="curve")
    for x, y in points:
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=ARM_BLUE)
    draw.line([tuple(knee), tuple(ankle)], fill=ARM_NAVY, width=2)
    x, y = ankle
    shift = -3 if side == "left" else 3
    draw.rounded_rectangle((x + shift - 5, y - 3, x + shift + 5, y + 4),
                           radius=2, fill=ARM_INK)
    draw.rounded_rectangle((x + shift - 3, y - 2, x + shift + 3, y + 2),
                           radius=1, fill=ARM_RED)
    return canvas


def upper(parts, dy=0, crouch=False):
    torso = parts["torso"]
    if crouch:
        torso = torso.resize((26, 15), Image.Resampling.NEAREST)
    result = blank()
    result.alpha_composite(torso, (35, 45 + dy))
    result.alpha_composite(parts["head"], (parts["head_at"][0], parts["head_at"][1] + dy))
    return result


def lobby_arm(parts, gloves, side, shoulder, elbow, wrist, gesture):
    canvas = blank()
    draw_limb(canvas, shoulder, elbow, wrist)
    left = side == "left"
    if gesture == "up":
        hand = gloves[0 if left else 1].resize((10, 10), Image.Resampling.NEAREST)
        at = (wrist[0] - 5, wrist[1] - 11)
    else:
        source = parts[side + "_arm"]
        hand = source.crop((0, 12, source.width, source.height)).resize(
            (10, 10), Image.Resampling.NEAREST)
        if gesture == "out":
            hand = hand.rotate(90 if left else -90, Image.Resampling.NEAREST, expand=True)
            at = (wrist[0] - hand.width + 2 if left else wrist[0] - 2,
                  wrist[1] - hand.height // 2)
        else:
            at = (wrist[0] - hand.width // 2, wrist[1] - 2)
    canvas.alpha_composite(hand, at)
    return canvas


def build_lobby(base, gloves):
    parts = front_parts(base)
    body = clean_body(base, "south")

    def pose(arms, dy=0, legs=None, crouch=False):
        layers, joints = [], []
        for side, shoulder, elbow, wrist, gesture in arms:
            layers.append(lobby_arm(parts, gloves, side, shoulder, elbow, wrist, gesture))
            joints.append({"side": side, "shoulder": list(shoulder), "elbow": list(elbow),
                           "wrist": list(wrist), "gesture": gesture})
        if legs is None:
            layers.append(body)
        else:
            layers.extend(legs)
            layers.append(upper(parts, dy, crouch))
        return overlay(layers), joints

    poses = [
        (base, []),
        pose([("left", (36, 50), (28, 58), (29, 63), "down"),
            ("right", (59, 50), (71, 39), (65, 23), "up")]),
        pose([("left", (37, 51), (25, 39), (30, 23), "up"),
              ("right", (59, 51), (71, 39), (65, 23), "up")]),
        pose([("left", (37, 47), (24, 35), (30, 19), "up"),
              ("right", (59, 47), (72, 35), (65, 19), "up")],
             dy=-4, legs=[articulated_leg((41, 57), (36, 63), (30, 68), "left"),
                           articulated_leg((55, 57), (60, 63), (66, 68), "right")]),
        pose([("left", (36, 48), (30, 43), (24, 42), "out"),
              ("right", (60, 48), (66, 43), (72, 42), "out")],
             dy=-2, legs=[articulated_leg((41, 60), (37, 69), (30, 73), "left"),
                           articulated_leg((55, 60), (59, 69), (66, 73), "right")]),
        pose([("left", (36, 57), (29, 64), (24, 70), "out"),
              ("right", (60, 57), (67, 64), (72, 70), "out")],
             dy=10, legs=[articulated_leg((40, 68), (32, 71), (24, 73), "left"),
                           articulated_leg((56, 68), (63, 71), (71, 73), "right")],
             crouch=True),
        pose([("left", (36, 54), (30, 58), (29, 64), "down"),
              ("right", (60, 54), (66, 58), (67, 64), "down")],
             dy=3, legs=[articulated_leg((41, 64), (39, 71), (33, 74), "left"),
                          articulated_leg((55, 64), (57, 71), (63, 74), "right")]),
        pose([("left", (36, 50), (28, 57), (29, 63), "down"),
              ("right", (59, 50), (71, 39), (65, 23), "up")]),
    ]
    records = []
    offsets = [0, 0, 0, -4, -2, 10, 3, 0]
    head = head_box(base)
    for index, (image, joints) in enumerate(poses):
        records.append({"path": save_frame(image, "lobby", "south", index),
                        "head": [head[0], head[1] + offsets[index],
                                 head[2], head[3] + offsets[index]], "limbs": joints})
    for name, image in parts.items():
        if not isinstance(image, Image.Image):
            continue
        target = OUT / "parts" / f"{name}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target)
    return records, [image for image, _ in poses]


def build_back_cast(base, gloves):
    arms, _, _ = carry_arms(*gloves, "north")
    ImageDraw.Draw(arms).rectangle((0, 0, 47, 95), fill=(0, 0, 0, 0))
    arms = shifted(arms, (-10, -6))
    body = clean_body(base, "north")
    body.alpha_composite(base.crop((26, 44, 39, 70)), (26, 44))
    motion = [(12, 28), (12, 28), (10, 22), (8, 16), (4, 10), (0, 0), (0, -1), (0, 1), (0, 0)]
    records = []
    for index, offset in enumerate(motion):
        pose = base if index == 0 else overlay([shifted(arms, offset), body])
        records.append({"path": save_frame(pose, "cast-up", "north", index),
                        "head": head_box(base), "wrist": [55 + offset[0], 14 + offset[1]]})
    return records


def preview(actions, lobby):
    strips = [(f"carry-walk {d}", [load(f["path"]) for f in frames])
              for d, frames in actions["carry-walk"].items()]
    strips.append(("presentation", lobby))
    sheet = Image.new("RGBA", (96 * 8, 108 * 4), (44, 44, 52, 255))
    draw = ImageDraw.Draw(sheet)
    for row, (label, images) in enumerate(strips):
        draw.text((3, row * 108), label, fill="white")
        for col, image in enumerate(images):
            sheet.alpha_composite(image, (col * 96, row * 108 + 12))
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST).save(OUT / "review.png")
    for direction, records in actions["carry-walk"].items():
        images = [load(record["path"]).resize((384, 384), Image.Resampling.NEAREST)
                  for record in records]
        images[0].save(OUT / f"carry-{direction}.gif", save_all=True, append_images=images[1:],
                       duration=120, loop=0, disposal=2)
    lobby[0].resize((384, 384), Image.Resampling.NEAREST).save(
        OUT / "presentation.gif", save_all=True,
        append_images=[image.resize((384, 384), Image.Resampling.NEAREST) for image in lobby[1:]],
        duration=[220, 150, 150, 180, 100, 180, 150, 250], loop=0, disposal=2)


def update_manifest(actions):
    path = ART / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    names = {"down": "south", "side": "east", "up": "north"}
    for row in manifest["rows"]:
        action = row["name"].split(".")[0]
        if row["name"] == "cast.up":
            records = actions["cast-up"]["north"]
            row["frames"] = [record["path"] for record in records]
            row["head_bounds"] = [record["head"] for record in records]
            row["wrist"] = records[5]["wrist"]
            row["status"] = "conventional northward wrist extension; release column 5"
            row.pop("source_indices", None)
        if action in ("carryIdle", "carryWalk", "lobby"):
            kind = {"carryIdle": "carry-idle", "carryWalk": "carry-walk", "lobby": "lobby"}[action]
            direction = names[row["name"].split(".")[-1]] if "." in row["name"] else "south"
            records = actions[kind][direction]
            row["frames"] = [record["path"] for record in records]
            row["head_bounds"] = [record["head"] for record in records]
            if kind != "lobby":
                row["palms"] = [record["palms"] for record in records]
                first = records[0]
                row["anchor"] = [(first["head"][0] + first["head"][2]) / 2,
                                 load(first["path"]).getbbox()[3]]
            row["status"] = "conventional source-pixel rig, visually reviewed"
    manifest["status"] = "complete-candidate-awaiting-runtime-validation"
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main():
    meta = json.loads((ART / "export/metadata.json").read_text(encoding="utf-8"))
    animations = meta["states"][0]["frames"]["animations"]
    raised = source_frames(animations, "Bombtop_carry_fixed_front.", "south")[4]
    base_path = source_frames(animations, "Walking", "south")[0]
    gloves = (load(raised).crop((15, 17, 28, 31)), load(raised).crop((57, 17, 71, 31)))
    actions, sources = build_carry(animations, gloves)
    lobby, images = build_lobby(load(base_path), gloves)
    actions["lobby"] = {"south": lobby}
    north_base = source_frames(animations, "Walking", "north")[0]
    actions["cast-up"] = {"north": build_back_cast(load(north_base), gloves)}
    sources.update((raised, base_path))
    report = {"tool": "Pillow", "method": "conventional source-pixel cutout rig",
              "sources": sorted(sources), "actions": actions,
              "open_glove_source": {"path": raised, "boxes": [[15, 17, 28, 31], [57, 17, 71, 31]]}}
    (OUT / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    update_manifest(actions)
    preview(actions, images)
    print("Pillow rig: 30 carry poses + 8 articulated presentation poses written.")


if __name__ == "__main__":
    main()
