"""Run with python apps/client/scripts/test-spider-pixellab.py; fixtures stay temporary."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw


PACKER = Path(__file__).with_name("pack-spider-pixellab.py")
NAMES = ["idle.down", "idle.side", "idle.up", "walk.down", "walk.side", "walk.up",
         "stun", "death", "cast.down", "cast.side", "cast.up", "carryIdle.down",
         "carryIdle.side", "carryIdle.up", "carryWalk.down", "carryWalk.side",
         "carryWalk.up", "lobby"]
COUNTS = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]


class SpiderAtlasTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = self.root / "manifest.json"
        self.output = self.root / "candidate.png"
        self.frame("standing.png")
        self.data = {"source_root": ".", "pixel_scale": 2, "rows": [
            {"name": name, "frames": ["standing.png"] * count}
            for name, count in zip(NAMES, COUNTS)]}

    def frame(self, name, box=(20, 10, 39, 49), size=(64, 64), mode="RGBA"):
        im = Image.new(mode, size)
        ImageDraw.Draw(im).rectangle(box, fill=(255, 30, 60, 128) if mode == "RGBA" else "red")
        im.save(self.root / name)

    def run_packer(self, *extra):
        self.manifest.write_text(json.dumps(self.data), encoding="utf-8")
        return subprocess.run([sys.executable, str(PACKER), "--manifest", str(self.manifest),
                               *extra], capture_output=True, text=True)

    def success(self):
        result = self.run_packer("--output", str(self.output))
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def reject(self, message):
        self.output.write_bytes(b"existing candidate")
        result = self.run_packer("--output", str(self.output))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertEqual(self.output.read_bytes(), b"existing candidate")

    def test_contract_pixels_unused_cells_and_determinism(self):
        report = self.success()
        self.assertEqual(report["geometry"], {"columns": 9, "rows": 18, "cell": [130, 161],
                                             "size": [1170, 2898], "anchor": [64.5, 155]})
        self.assertEqual(report["frame_counts"], COUNTS)
        self.assertEqual(report["bodyH"], 80)
        with Image.open(self.output) as atlas:
            self.assertEqual(atlas.mode, "RGBA")
            self.assertEqual(atlas.size, (1170, 2898))
            for row, count in enumerate(COUNTS):
                for col in range(9):
                    cell = atlas.crop((col * 130, row * 161, (col + 1) * 130, (row + 1) * 161))
                    self.assertEqual(cell.getchannel("A").getbbox(), (45, 76, 85, 156) if col < count else None)
            self.assertEqual(atlas.getpixel((45, 76)), (255, 30, 60, 128))
            self.assertEqual(atlas.getpixel((46, 77)), (255, 30, 60, 128))
        before = self.output.read_bytes()
        self.success()
        self.assertEqual(before, self.output.read_bytes())

    def test_row_registration_preserves_shift_and_explicit_holds(self):
        self.frame("shift.png", (23, 8, 42, 47))
        self.data["rows"][0]["frames"] = ["standing.png", "shift.png", "shift.png", "standing.png"]
        self.success()
        with Image.open(self.output) as atlas:
            cells = [atlas.crop((i * 130, 0, (i + 1) * 130, 161)) for i in range(4)]
            self.assertEqual(cells[1].getchannel("A").getbbox(), (51, 72, 91, 152))
            self.assertEqual(cells[1].tobytes(), cells[2].tobytes())
            self.assertEqual(cells[0].tobytes(), cells[3].tobytes())

    def test_supplied_anchor_and_96px_sources(self):
        self.frame("large.png", (20, 10, 39, 49), (96, 96))
        self.data["rows"][0].update(frames=["large.png"] * 4, anchor=[31, 51])
        self.success()
        with Image.open(self.output) as atlas:
            self.assertEqual(atlas.crop((0, 0, 130, 161)).getchannel("A").getbbox(), (43, 74, 83, 154))

    def test_named_rows_can_arrive_out_of_order(self):
        self.data["rows"].reverse()
        report = self.success()
        self.assertEqual([r["name"] for r in report["rows"]], NAMES)

    def test_custom_v3_88px_canvas_keeps_registration(self):
        self.frame("custom.png", (20, 10, 39, 49), (88, 88))
        self.data["rows"][8]["frames"] = ["custom.png"] * 9
        report = self.success()
        self.assertEqual(report["rows"][8]["source_sizes"], [[88, 88]] * 9)
        self.assertEqual(report["rows"][8]["bounds"][0], [45, 76, 85, 156])

    def test_missing_row(self):
        self.data["rows"].pop(0)
        self.reject("idle.down")

    def test_duplicate_or_unknown_rows(self):
        for name in ("idle.down", "other"):
            with self.subTest(name=name):
                self.data["rows"][-1]["name"] = name
                self.reject("rows")

    def test_exact_frame_counts_no_fallback(self):
        for count in (3, 5):
            with self.subTest(count=count):
                self.data["rows"][0]["frames"] = ["standing.png"] * count
                self.reject("idle.down: expected 4 frames")

    def test_missing_source(self):
        self.data["rows"][0]["frames"][2] = "missing.png"
        self.reject("missing.png")

    def test_reject_clipping_in_any_direction(self):
        cases = (
            ((0, 10, 39, 49), [45, 50], (-25, 76, 55, 156)),
            ((20, 10, 63, 49), [30, 50], (45, 76, 133, 156)),
            ((20, 0, 39, 49), [30, 80], (45, -4, 85, 96)),
            ((20, 10, 39, 63), [30, 50], (45, 76, 85, 184)),
        )
        for box, anchor, bounds in cases:
            with self.subTest(bounds=bounds):
                self.frame("shift.png", box)
                self.data["rows"][0]["frames"][1] = "shift.png"
                self.data["rows"][0]["anchor"] = anchor
                self.reject(f"idle.down frame 1: alpha bounds {bounds} clips outside cell")

    def test_reject_anchor_that_would_resample_or_is_invalid(self):
        for anchor in ([30.1, 50], [30], [True, 50], [30, float("nan")]):
            with self.subTest(anchor=anchor):
                self.data["rows"][0]["anchor"] = anchor
                self.reject("anchor")

    def test_measure_standing_body_height_from_alpha(self):
        self.frame("tall.png", (20, 5, 39, 49))
        self.data["rows"][2]["frames"][2] = "tall.png"
        self.assertEqual(self.success()["bodyH"], 90)

    def test_reject_modes_sizes_empty_frames_and_scale(self):
        for mode, size, message in (("RGB", (64, 64), "RGBA"), ("RGBA", (65, 64), "64x64, 88x88 or 96x96")):
            self.frame("bad.png", mode=mode, size=size)
            self.data["rows"][0]["frames"][0] = "bad.png"
            self.reject(message)
        Image.new("RGBA", (64, 64)).save(self.root / "bad.png")
        self.reject("empty alpha")
        self.data["pixel_scale"] = 1
        self.reject("pixel_scale")

    def test_output_is_required(self):
        result = self.run_packer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--output", result.stderr)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
