"""Read-only eye-repair regressions; run with python -B <this script>.

Boxes are pose-local, half-open Pillow rectangles, not batch tile coordinates.
Color checks are deliberately broad presence checks, not eye-shape approval.
No images, reports, or other artifacts are written.
"""
import json
from pathlib import Path
import unittest

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[3]
REDRAW = ROOT / "concept/lantern/redraw"
CELL = (132, 164)
SIZE = (1188, 2952)
SAMPLES = ("r00-c02", "r03-c03", "r08-c02", "r17-c03")


def read_rgba(path, size=CELL):
    with Image.open(path) as source:
        if source.mode != "RGBA" or source.size != size:
            raise AssertionError(
                f"{path}: expected RGBA {size}, got {source.mode} {source.size}"
            )
        return source.copy()


class LanternEyeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ledger = json.loads((REDRAW / "eyes-fix/ledger.json").read_text(encoding="utf-8-sig"))
        cls.members = {}
        for batch in ledger:
            for member in batch["members"]:
                pose = member["pose"]
                if pose in cls.members:
                    raise AssertionError(f"duplicate ledger pose: {pose}")
                boxes = member["boxes"]
                if not boxes or any(
                    len(box) != 4 or not all(type(n) is int for n in box)
                    or not (0 <= box[0] < box[2] <= CELL[0]
                            and 0 <= box[1] < box[3] <= CELL[1])
                    for box in boxes
                ):
                    raise AssertionError(f"invalid repair boxes: {pose}: {boxes}")
                cls.members[pose] = member
        cls.mapping = json.loads((REDRAW / "pose-map.json").read_text(encoding="utf-8-sig"))
        cls.poses = {cell["pose"] for cell in cls.mapping["cells"]}
        baseline = REDRAW / "eyes-fix/before-generated"
        snapshot_poses = {path.stem for path in baseline.glob("*.png")}
        if len(cls.poses) != 84 or snapshot_poses != cls.poses:
            raise AssertionError("expected complete baseline of all 84 mapped poses")
        if len(cls.members) != 51 or not cls.members.keys() <= cls.poses:
            raise AssertionError("expected 51 open-eye repair poses, excluding closed death eyes")
        cls.before = {pose: read_rgba(baseline / f"{pose}.png") for pose in cls.poses}
        cls.after = {pose: read_rgba(REDRAW / "generated" / f"{pose}.png")
                     for pose in cls.poses}

    def test_01_changed_pixels_stay_inside_eye_boxes(self):
        for pose in sorted(self.poses):
            with self.subTest(pose=pose):
                allowed = Image.new("L", CELL)
                draw = ImageDraw.Draw(allowed)
                for left, top, right, bottom in self.members.get(pose, {}).get("boxes", []):
                    draw.rectangle((left, top, right - 1, bottom - 1), fill=255)
                # Combine every channel: RGBA.getbbox alone can miss RGB-only changes.
                difference = ImageChops.difference(self.before[pose], self.after[pose])
                changed = Image.new("L", CELL)
                for channel in difference.split():
                    changed = ImageChops.lighter(changed, channel)
                outside = ImageChops.multiply(changed, ImageChops.invert(allowed))
                self.assertIsNone(outside.getbbox(),
                                  f"{pose}: changed pixels outside eye boxes: {outside.getbbox()}")

    def test_02_all_alpha_is_unchanged(self):
        for pose in sorted(self.poses):
            with self.subTest(pose=pose):
                self.assertEqual(self.before[pose].getchannel("A").tobytes(),
                                 self.after[pose].getchannel("A").tobytes(),
                                 f"{pose}: alpha changed")

    def test_03_unselected_poses_are_pixel_identical(self):
        for pose in sorted(self.poses - self.members.keys()):
            with self.subTest(pose=pose):
                self.assertEqual(self.before[pose].tobytes(), self.after[pose].tobytes(),
                                 f"{pose}: unselected pose changed")

    def test_04_historical_atlas_matches_repack(self):
        counts = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]
        self.assertEqual(self.mapping["counts"], counts)
        cells = self.mapping["cells"]
        expected = {(row, col) for row, count in enumerate(counts) for col in range(count)}
        self.assertEqual(len(cells), len(expected))
        self.assertEqual({(cell["row"], cell["col"]) for cell in cells}, expected)
        repacked = Image.new("RGBA", SIZE)
        for cell in cells:
            repacked.paste(self.after[cell["pose"]],
                           (cell["col"] * CELL[0], cell["row"] * CELL[1]))
        self.assertEqual(read_rgba(REDRAW / "candidate.png", SIZE).tobytes(),
                         repacked.tobytes(),
                         "historical candidate differs from exact pose-map repack")

    def test_07_approved_atlas_matches_native_repack_and_production(self):
        approved = ROOT / "concept/lantern/restart-skeleton"
        cells = self.mapping["cells"]
        self.assertEqual(len(cells), 108)
        native = {pose: read_rgba(approved / "raw" / f"{pose}.png", (128, 160))
                  for pose in self.poses}
        repacked = Image.new("RGBA", SIZE)
        for cell in cells:
            # Paste without a mask to preserve every raw RGBA byte, including alpha.
            repacked.paste(native[cell["pose"]],
                           (cell["col"] * CELL[0] + 2, cell["row"] * CELL[1] + 2))
        candidate = read_rgba(approved / "candidate.png", SIZE)
        # Whole-sheet equality also requires the 2px borders and unused row tails
        # to remain transparent black, with no resampling or extra artwork.
        self.assertEqual(candidate.tobytes(), repacked.tobytes(),
                         "approved candidate differs from native pose-map repack")
        production = read_rgba(ROOT / "apps/client/public/sprites/lantern.png", SIZE)
        self.assertEqual(production.tobytes(), candidate.tobytes(),
                         "production atlas differs from approved candidate")

    def test_05_selected_poses_have_actual_repairs(self):
        for pose in sorted(self.members):
            with self.subTest(pose=pose):
                self.assertTrue(self.before[pose].tobytes() != self.after[pose].tobytes(),
                                    f"{pose}: repair has not changed any pixels")

    def test_06_front_eyes_contain_white_emerald_and_dark(self):
        # Require each sampled eye to contain the three colors. No required area,
        # aspect ratio, exact palette, or pupil position; dark outlines may also
        # satisfy the dark predicate, so this does not replace visual review.
        for pose in SAMPLES:
            self.assertIn(pose, self.members)
            for index, box in enumerate(self.members[pose]["boxes"]):
                with self.subTest(pose=pose, eye=index):
                    pixels = [(r, g, b) for r, g, b, a in self.after[pose].crop(box).getdata()
                              if a >= 128]
                    self.assertTrue(any(min(rgb) >= 180 and max(rgb) - min(rgb) <= 60
                                        for rgb in pixels), "missing eye white")
                    self.assertTrue(any(g >= 70 and g > r * 1.2 and g > b * 1.1
                                        for r, g, b in pixels), "missing emerald iris")
                    self.assertTrue(any(max(rgb) <= 85 for rgb in pixels),
                                    "missing dark pupil/outline")


if __name__ == "__main__":
    unittest.main(verbosity=2)
