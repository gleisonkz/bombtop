"""Contract checks for conventional PixelLab part animation (no image model)."""
import hashlib
import json
from pathlib import Path
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/spider/pixellab"


class SpiderRigTests(unittest.TestCase):
    def test_articulated_limbs_connect_shoulders_elbows_wrists_and_gloves(self):
        report = json.loads((ART / "rigged/report.json").read_text())
        for action in ("carry-idle", "carry-walk"):
            for direction, frames in report["actions"][action].items():
                for frame in frames:
                    image = Image.open(ART / frame["path"]).convert("RGBA")
                    self.assertEqual(len(frame["limbs"]), 2, (action, direction))
                    for limb in frame["limbs"]:
                        for key in ("shoulder", "elbow", "wrist"):
                            point = limb[key]
                            self.assertTrue(0 <= point[0] < 96 and 0 <= point[1] < 96)
                            self.assertGreater(image.getpixel(tuple(point))[3], 128,
                                               (action, direction, frame["path"], key))
                        for start, end in (("shoulder", "elbow"), ("elbow", "wrist")):
                            a, b = limb[start], limb[end]
                            for step in range(11):
                                x = round(a[0] + (b[0] - a[0]) * step / 10)
                                y = round(a[1] + (b[1] - a[1]) * step / 10)
                                self.assertGreater(image.getpixel((x, y))[3], 128,
                                                   (action, direction, frame["path"], start, end))
                        self.assertLessEqual(abs(limb["shoulder"][0] - limb["wrist"][0]), 30)

    def test_complete_directional_motion_and_open_grips(self):
        report = json.loads((ART / "rigged/report.json").read_text())
        for action, count in (("carry-idle", 4), ("carry-walk", 6)):
            for direction in ("south", "east", "north"):
                frames = report["actions"][action][direction]
                self.assertEqual(len(frames), count)
                hashes = set()
                for frame in frames:
                    with Image.open(ART / frame["path"]) as image:
                        self.assertEqual(image.mode, "RGBA")
                        self.assertEqual(image.size, (96, 96))
                        self.assertIsNotNone(image.getchannel("A").getbbox())
                        hashes.add(hashlib.sha256(image.tobytes()).digest())
                        for x, y in frame["palms"]:
                            self.assertGreater(image.getpixel((round(x), round(y)))[3], 128)
                            self.assertLess(y, frame["head"][1] + 6)
                self.assertGreaterEqual(len(hashes), 3 if count == 4 else 6)

    def test_walk_preserves_original_mask_and_steps(self):
        report = json.loads((ART / "rigged/report.json").read_text())
        for direction, frames in report["actions"]["carry-walk"].items():
            for frame in frames:
                source = Image.open(ART / frame["source"]).convert("RGBA")
                actual = Image.open(ART / frame["path"]).convert("RGBA")
                left, top, right, bottom = frame["head"]
                for y in range(top, bottom):
                    for x in range(left, right):
                        if source.getpixel((x, y))[3]:
                            self.assertEqual(source.getpixel((x, y)), actual.getpixel((x, y)))
                self.assertEqual(source.crop((0, 70, 96, 96)).tobytes(),
                                 actual.crop((0, 70, 96, 96)).tobytes())

    def test_presentation_has_eight_distinct_articulated_poses(self):
        frames = sorted((ART / "rigged/lobby/south").glob("*.png"))
        self.assertEqual(len(frames), 8)
        images = [Image.open(path).convert("RGBA") for path in frames]
        self.assertEqual(len({image.tobytes() for image in images}), 8)
        self.assertGreaterEqual(max(image.getbbox()[1] for image in images)
                                - min(image.getbbox()[1] for image in images), 8)

    def test_presentation_shoulders_and_hands_follow_the_rig(self):
        report = json.loads((ART / "rigged/report.json").read_text())
        frames = report["actions"]["lobby"]["south"]
        self.assertEqual(len(frames), 8)
        for frame in frames[1:]:
            self.assertEqual(len(frame["limbs"]), 2, frame["path"])
            image = Image.open(ART / frame["path"]).convert("RGBA")
            for limb in frame["limbs"]:
                for start, end in (("shoulder", "elbow"), ("elbow", "wrist")):
                    a, b = limb[start], limb[end]
                    for step in range(11):
                        x = round(a[0] + (b[0] - a[0]) * step / 10)
                        y = round(a[1] + (b[1] - a[1]) * step / 10)
                        self.assertGreater(image.getpixel((x, y))[3], 128,
                                           (frame["path"], limb["side"], start, end))
                self.assertLessEqual(abs(limb["shoulder"][0] - limb["wrist"][0]), 25)
                self.assertLessEqual(abs(limb["shoulder"][1] - limb["wrist"][1]), 40)

    def test_presentation_has_no_detached_limb_fragments(self):
        for path in sorted((ART / "rigged/lobby/south").glob("*.png")):
            image = Image.open(path).convert("RGBA")
            remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                         if image.getpixel((x, y))[3] > 128}
            component_sizes = []
            while remaining:
                stack = [remaining.pop()]
                size = 0
                while stack:
                    x, y = stack.pop()
                    size += 1
                    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                        point = (x + dx, y + dy)
                        if point in remaining:
                            remaining.remove(point)
                            stack.append(point)
                component_sizes.append(size)
            self.assertEqual(len([size for size in component_sizes if size >= 12]), 1,
                             (path.name, sorted(component_sizes, reverse=True)[:6]))

    def test_rig_output_contains_only_existing_source_pixel_colors(self):
        report = json.loads((ART / "rigged/report.json").read_text())
        palette = set()
        for source in report["sources"]:
            palette.update(pixel for pixel in Image.open(ART / source).convert("RGBA").getdata()
                           if pixel[3])
        for path in (ART / "rigged").glob("*/**/*.png"):
            if "parts" in path.parts:
                continue
            image = Image.open(path).convert("RGBA")
            colors = {pixel for pixel in image.getdata() if pixel[3]}
            self.assertFalse(colors - palette, str(path))

    def test_complete_manifest_and_promoted_atlas_match(self):
        manifest = json.loads((ART / "manifest.json").read_text())
        self.assertEqual([len(row["frames"]) for row in manifest["rows"]],
                         [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8])
        candidate = ART / "spider-candidate.png"
        production = ROOT / "apps/client/public/sprites/spider.png"
        self.assertEqual(candidate.read_bytes(), production.read_bytes())

    def test_north_cast_releases_above_the_back_mask_at_column_five(self):
        report = json.loads((ART / "rigged/report.json").read_text())
        frames = report["actions"]["cast-up"]["north"]
        self.assertEqual(len(frames), 9)
        release = frames[5]
        self.assertLess(release["wrist"][1], release["head"][1])
        image = Image.open(ART / release["path"])
        self.assertGreater(image.getpixel(tuple(release["wrist"]))[3], 128)
        self.assertGreater(frames[1]["wrist"][1], release["wrist"][1] + 20)


if __name__ == "__main__":
    unittest.main()
