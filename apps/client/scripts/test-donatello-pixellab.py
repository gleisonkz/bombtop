"""Temporary synthetic fixtures: python apps/client/scripts/test-donatello-pixellab.py."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True


PACKER = Path(__file__).resolve().parents[3] / "concept/donatello/pixellab-redraw/pack.py"
NAMES = ["idle-south", "idle-east", "idle-north", "walk-south", "walk-east",
         "walk-north", "stun-south", "death-south", "cast-south", "cast-east",
         "cast-north", "carryIdle-south", "carryIdle-east", "carryIdle-north",
         "carryWalk-south", "carryWalk-east", "carryWalk-north", "lobby-south"]
COUNTS = [4, 4, 4, 6, 6, 6, 6, 6, 9, 9, 9, 4, 4, 4, 6, 6, 6, 12]


class DonatelloPackingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.frame("base.png")
        self.data = {"rows": [{"name": name, "frames": ["base.png"] * count}
                              for name, count in zip(NAMES, COUNTS)]}

    def frame(self, name, box=(40, 30, 79, 152), size=(160, 160), mode="RGBA"):
        image = Image.new(mode, size)
        ImageDraw.Draw(image).rectangle(box, fill=(91, 43, 211, 128) if mode == "RGBA" else "red")
        image.save(self.root / name)

    def build(self):
        path = self.root / "selections.json"
        path.write_text(json.dumps(self.data), encoding="utf-8")
        spec = importlib.util.spec_from_file_location("donatello_pack", PACKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.build_sheet(path)

    def test_contract_pixels_and_empty_tails(self):
        sheet, report = self.build()
        self.assertEqual(sheet.size, (3072, 4032))
        self.assertEqual(sheet.mode, "RGBA")
        self.assertEqual(report["frame_counts"], COUNTS)
        self.assertEqual(sum(COUNTS), 111)
        self.assertEqual(report["bodyH"], 123)
        self.assertEqual(report["anchor"], [128, 208])
        self.assertEqual(sheet.getpixel((108, 85)), (91, 43, 211, 128))
        for row, count in enumerate(COUNTS):
            for col in range(12):
                cell = sheet.crop((col * 256, row * 224, (col + 1) * 256, (row + 1) * 224))
                self.assertEqual(cell.getchannel("A").getbbox(),
                                 (108, 85, 148, 208) if col < count else None)

    def test_common_translation_varying_canvases_and_metadata(self):
        self.frame("shift.png", box=(43, 28, 82, 150), size=(256, 192))
        row = self.data["rows"][0]
        row.update(frames=["base.png", "shift.png", "shift.png", "base.png"],
                   anchor=[60, 153], palms=[[[50, 90], [70, 90]]] * 4,
                   headbounds=[[44, 30, 76, 60]] * 4, metadata={"note": "fixture"})
        sheet, report = self.build()
        self.assertEqual(report["rows"][0]["offset"], [68, 55])
        self.assertEqual(report["rows"][0]["bounds"][1], [111, 83, 151, 206])
        self.assertEqual(report["rows"][0]["palms"][0], [[118, 145], [138, 145]])
        self.assertEqual(report["rows"][0]["headbounds"][0], [112, 85, 144, 115])
        self.assertEqual(report["rows"][0]["metadata"], {"note": "fixture"})
        self.assertEqual(sheet.crop((256, 0, 512, 224)).tobytes(),
                         sheet.crop((512, 0, 768, 224)).tobytes())

    def test_odd_width_baseline_does_not_resample(self):
        self.frame("base.png", box=(40, 30, 80, 152))
        sheet, report = self.build()
        self.assertEqual(report["rows"][0]["offset"], [68, 55])
        self.assertEqual(sheet.getpixel((108, 85)), (91, 43, 211, 128))

    def test_named_rows_and_idle_height(self):
        self.frame("tall.png", box=(40, 20, 79, 152))
        self.data["rows"][2]["frames"][2] = "tall.png"
        self.data["rows"].reverse()
        _, report = self.build()
        self.assertEqual([row["name"] for row in report["rows"]], NAMES)
        self.assertEqual(report["bodyH"], 133)

    def test_rejects_invalid_contract(self):
        original = json.loads(json.dumps(self.data))
        for change in (lambda rows: rows.pop(),
                       lambda rows: rows[0].update(name="unknown"),
                       lambda rows: rows[-1].update(name="idle-south"),
                       lambda rows: rows[0].update(frames=["base.png"] * 3)):
            self.data = json.loads(json.dumps(original))
            change(self.data["rows"])
            with self.assertRaises(ValueError):
                self.build()

    def test_rejects_missing_empty_and_non_rgba(self):
        for name in ("missing.png", "empty.png", "rgb.png"):
            Image.new("RGBA", (256, 256)).save(self.root / "empty.png")
            self.frame("rgb.png", mode="RGB")
            self.data["rows"][0]["frames"][0] = name
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.build()

    def test_rejects_escaping_paths_and_all_missing(self):
        for value in ("../outside.png", str((self.root / "base.png").resolve()), "absent.png"):
            for row in self.data["rows"]:
                row["frames"] = [value] * len(row["frames"])
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.build()

    def test_clipping_all_directions(self):
        for anchor in ([250, 153], [-200, 153], [60, 300], [60, 0]):
            self.data["rows"][0]["anchor"] = anchor
            with self.subTest(anchor=anchor), self.assertRaisesRegex(ValueError, "clips"):
                self.build()

    def test_rejects_fractional_anchors_and_bad_metadata(self):
        for anchor in ([60.5, 153], [True, 153], [60, float("nan")]):
            self.data["rows"][0]["anchor"] = anchor
            with self.assertRaisesRegex(ValueError, "anchor"):
                self.build()
        self.data["rows"][0].pop("anchor")
        self.data["rows"][0]["palms"] = [[[1, 2]]]
        with self.assertRaisesRegex(ValueError, "palms"):
            self.build()

    def test_cli_outputs_and_validation_before_writing(self):
        self.build()
        command = [sys.executable, str(PACKER), "--selections", str(self.root / "selections.json")]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        outputs = [self.root / name for name in
                   ("donatello-candidate.png", "sheet-review.png", "manifest.json")]
        before = [path.read_bytes() for path in outputs]
        self.assertEqual(json.loads(before[2])["bodyH"], 123)
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([path.read_bytes() for path in outputs], before)
        self.data["rows"][-1]["frames"][-1] = "absent.png"
        (self.root / "selections.json").write_text(json.dumps(self.data), encoding="utf-8")
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("absent.png", result.stderr)
        self.assertEqual([path.read_bytes() for path in outputs], before)


if __name__ == "__main__":
    unittest.main()
