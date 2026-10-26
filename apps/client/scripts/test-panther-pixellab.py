"""Fixture tests for the isolated Panther candidate packer; no runtime writes."""
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
PACK = ROOT / "concept/pink-panther/pixellab-redraw/pack.py"


class PackingTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(PACK.exists(), "candidate packer must exist")
        spec = importlib.util.spec_from_file_location("panther_pack", PACK)
        self.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.pack)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.rows = []
        for name, count in self.pack.CONTRACT:
            frames = []
            for col in range(count):
                filename = f"{name}-{col}.png"
                image = Image.new("RGBA", (240, 240))
                image.putpixel((100 + col, 100), (255, 30 + col, 130, 128))
                image.save(self.root / filename)
                frames.append(filename)
            self.rows.append({"name": name, "frames": frames, "anchor": [120, 220]})

    def build(self):
        path = self.root / "manifest.json"
        path.write_text(json.dumps({"rows": self.rows}))
        return self.pack.build_sheet(path)

    def test_contract_and_empty_gutters(self):
        atlas, report = self.build()
        self.assertEqual(atlas.size, (7 * 224, 17 * 224))
        self.assertEqual(report["count"], 107)
        self.assertIsNone(atlas.crop((4 * 224, 0, 7 * 224, 224)).getchannel("A").getbbox())
        self.assertEqual(report["lobby"]["width"], 16 * 224)
        output = self.root / "candidate.png"
        subprocess.run([sys.executable, str(PACK), "--manifest", str(self.root / "manifest.json"),
                        "--output", str(output)], check=True, capture_output=True)
        with Image.open(self.root / "candidate-lobby.png") as lobby:
            self.assertEqual(lobby.size, (3584, 224))
        self.assertTrue((self.root / "candidate-report.json").exists())

    def test_native_pixels_and_one_translation_per_row(self):
        self.rows[0]["frames"][0] = {"path": self.rows[0]["frames"][0],
                                       "head": {"x": 100, "y": 100},
                                       "palms": [{"x": 110, "y": 110, "span": 12}]}
        atlas, report = self.build()
        self.assertEqual(atlas.getpixel((92, 88)), (255, 30, 130, 128))
        self.assertEqual(atlas.getpixel((224 + 93, 88)), (255, 31, 130, 128))
        self.assertEqual(report["rows"][0]["translation"], [-8, -12])
        self.assertEqual(report["rows"][0]["frames"][0]["head"], {"x": 92, "y": 88})
        self.assertEqual(report["rows"][0]["frames"][0]["palms"][0], {"x": 102, "y": 98, "span": 12})
        self.rows.pop()  # Lobby is genuinely optional.
        image = Image.new("RGBA", (280, 240))
        image.putpixel((240, 100), (1, 2, 3, 255))
        image.save(self.root / "wide.png")
        self.rows[0]["frames"][0] = "wide.png"
        atlas, report = self.build()
        self.assertEqual(report["frameW"], 256)
        self.assertEqual(atlas.size, (1792, 4352))
        self.assertEqual(atlas.getpixel((232, 88)), (1, 2, 3, 255))
        self.assertIsNone(report["lobby"])

    def test_missing_frame_rejected(self):
        (self.root / self.rows[0]["frames"][0]).unlink()
        with self.assertRaisesRegex(ValueError, "read"):
            self.build()

    def test_empty_and_rgb_rejected(self):
        path = self.root / self.rows[0]["frames"][0]
        for mode in ("RGBA", "RGB"):
            Image.new(mode, (240, 240)).save(path)
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                self.build()

    def test_clipping_and_gutter_contact_rejected(self):
        for x in (0, 8):
            image = Image.new("RGBA", (240, 240))
            image.putpixel((x, 100), (255, 0, 0, 255))
            image.save(self.root / self.rows[0]["frames"][0])
            with self.subTest(x=x), self.assertRaisesRegex(ValueError, "bounds|gutter"):
                self.build()

    def test_inventory_rejected(self):
        self.rows[0]["frames"].pop()
        with self.assertRaisesRegex(ValueError, "frames"):
            self.build()
        self.rows.pop()
        self.rows.pop()
        with self.assertRaises(ValueError):
            self.build()

    def test_duplicate_requires_explicit_hold(self):
        self.rows[0]["frames"][1] = self.rows[0]["frames"][0]
        with self.assertRaisesRegex(ValueError, "hold"):
            self.build()
        self.rows[0]["frames"][1] = {"hold": 0}
        atlas, report = self.build()
        self.assertEqual(report["rows"][0]["frames"][1]["hold"], 0)
        self.assertEqual(atlas.crop((0, 0, 224, 224)).tobytes(), atlas.crop((224, 0, 448, 224)).tobytes())

    def test_fractional_translation_rejected(self):
        self.rows[0]["anchor"] = [120.5, 220]
        with self.assertRaisesRegex(ValueError, "integer"):
            self.build()


if __name__ == "__main__":
    unittest.main()
