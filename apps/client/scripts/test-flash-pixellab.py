"""Temporary-fixture contract tests: python -B apps/client/scripts/test-flash-pixellab.py."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

SCRIPT = Path(__file__).with_name("pack-flash-pixellab.py")
SPEC = importlib.util.spec_from_file_location("flash_packer", SCRIPT)
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)
NAMES = ("idle.down", "idle.side", "idle.up", "walk.down", "walk.side", "walk.up",
         "stun", "death", "cast.down", "cast.side", "cast.up", "carryIdle.down",
         "carryIdle.side", "carryIdle.up", "carryWalk.down", "carryWalk.side", "carryWalk.up", "lobby")
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 16)


class PackingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = self.root / "manifest.json"
        self.out = self.root / "output"
        image = Image.new("RGBA", (30, 40))
        image.paste((80, 120, 180, 127), (8, 10, 12, 30))
        image.save(self.root / "a.png")
        image = Image.new("RGBA", (50, 60))
        image.paste((240, 30, 90, 63), (11, 8, 15, 32))
        image.save(self.root / "b.png")
        self.data = {"source_root": ".", "rows": [
            {"name": name, "frames": ["a.png", "b.png"] + ["a.png"] * (count - 2)}
            for name, count in zip(NAMES, COUNTS)]}

    def run_pack(self):
        self.manifest.write_text(json.dumps(self.data), encoding="utf-8")
        return PACK.pack(self.manifest, self.out)

    def test_geometry_registration_pixels_and_report(self):
        report = self.run_pack()
        for name, size in (("flash-candidate.png", (3584, 4032)),):
            with Image.open(self.out / name) as sheet:
                self.assertEqual(sheet.size, size)
                self.assertEqual(sheet.mode, "RGBA")
        with Image.open(self.out / "flash-candidate.png") as sheet:
            self.assertEqual(sheet.getpixel((110, 192)), (80, 120, 180, 127))
            self.assertEqual(sheet.getpixel((224 + 113, 190)), (240, 30, 90, 63))
            self.assertIsNone(sheet.crop((4 * 224, 0, 16 * 224, 224)).getbbox())
            for row, count in enumerate(COUNTS):
                tail = sheet.crop((count * 224, row * 224, 16 * 224, (row + 1) * 224))
                self.assertEqual(tail.tobytes(), bytes(tail.width * tail.height * 4))
                for column in range(count):
                    expected = Image.new("RGBA", (224, 224))
                    with Image.open(self.root / ("b.png" if column == 1 else "a.png")) as source:
                        expected.paste(source, (102, 182))
                    cell = sheet.crop((column * 224, row * 224, (column + 1) * 224, (row + 1) * 224))
                    self.assertEqual(cell.tobytes(), expected.tobytes())
        self.assertEqual(sum(len(row["sourcepaths"]) for row in report["rows"]), 116)
        self.assertEqual(report["rows"][0]["offset"], [102, 182])
        self.assertEqual(report["rows"][0]["bounds"][:2], [[110, 192, 114, 212], [113, 190, 117, 214]])
        self.assertEqual(report["bodyH"], 24)
        self.assertEqual(report["menuBodyH"], 20)
        self.assertEqual(json.loads((self.out / "report.json").read_text()), report)

    def test_explicit_anchor_is_shared_by_strip(self):
        self.data["rows"][0]["anchor"] = [12, 32]
        self.data["rows"][-1]["anchor"] = [12, 32]
        report = self.run_pack()
        self.assertEqual(report["rows"][0]["offset"], [100, 180])
        self.assertEqual(report["rows"][-1]["offset"], [100, 180])

    def test_invalid_inputs_write_nothing(self):
        cases = ("count", "lobby", "missing", "duplicate", "unknown",
                 "rgb", "empty", "large", "clip", "fractional", "nan")
        original = json.dumps(self.data)
        for case in cases:
            with self.subTest(case=case):
                self.data = json.loads(original)
                if case == "count": self.data["rows"][0]["frames"].pop()
                elif case == "lobby": self.data["rows"][-1]["frames"].pop()
                elif case == "missing": self.data["rows"].pop()
                elif case == "duplicate": self.data["rows"][-1] = self.data["rows"][0]
                elif case == "unknown": self.data["rows"][0]["name"] = "oops"
                elif case in ("fractional", "nan"):
                    self.data["rows"][-1]["anchor"] = [0.5 if case == "fractional" else float("nan"), 30]
                else:
                    image = Image.new("RGB" if case == "rgb" else "RGBA",
                                      (513, 40) if case == "large" else (512, 40))
                    if case != "empty": image.paste((255, 0, 0) if case == "rgb" else (255, 0, 0, 1), (0, 0, image.width, 40))
                    image.save(self.root / "bad.png")
                    self.data["rows"][-1]["frames"][-1] = "bad.png"
                with self.assertRaises(ValueError): self.run_pack()
                self.assertFalse(self.out.exists())

    def test_cli_failure_preserves_existing_outputs(self):
        self.out.mkdir()
        sentinel = self.out / "flash-candidate.png"
        sentinel.write_bytes(b"existing candidate")
        self.data["rows"][-1]["frames"][-1] = "missing.png"
        self.manifest.write_text(json.dumps(self.data))
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), "--manifest", str(self.manifest),
                                 "--output-dir", str(self.out)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot read", result.stderr)
        self.assertEqual(sentinel.read_bytes(), b"existing candidate")
        self.assertEqual(list(self.out.iterdir()), [sentinel])

    def test_exact_boundary_and_transparent_native_margins(self):
        image = Image.new("RGBA", (512, 512))
        image.paste((12, 34, 56, 1), (200, 200, 424, 424))
        image.save(self.root / "boundary.png")
        self.data["rows"][-1] = {"name": "lobby", "frames": ["boundary.png"] * 16, "anchor": [312, 412]}
        report = self.run_pack()
        self.assertEqual(report["rows"][-1]["bounds"][0], [0, 0, 224, 224])
        with Image.open(self.out / "flash-candidate.png") as sheet:
            self.assertEqual(sheet.getpixel((3583, 4031)), (12, 34, 56, 1))

    def test_odd_bbox_rounds_default_anchor_and_keeps_row_motion(self):
        image = Image.new("RGBA", (31, 43))
        image.paste((13, 27, 59, 83), (8, 10, 13, 30))
        image.save(self.root / "odd.png")
        self.data["rows"][0]["frames"][0] = "odd.png"
        report = self.run_pack()
        self.assertEqual(report["rows"][0]["offset"], [102, 182])
        self.assertEqual(report["rows"][0]["bounds"][1], [113, 190, 117, 214])

    def test_cli_success(self):
        self.manifest.write_text(json.dumps(self.data))
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), "--manifest", str(self.manifest),
                                 "--output-dir", str(self.out)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(list(self.out.iterdir())), 2)


if __name__ == "__main__":
    unittest.main()
