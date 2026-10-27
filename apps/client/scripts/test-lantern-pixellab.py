"""Temporary fixtures only: python -B apps/client/scripts/test-lantern-pixellab.py."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

sys.dont_write_bytecode = True
PACKER = Path(__file__).with_name("pack-lantern-pixellab.py")
COUNTS = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]


class LanternPackingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "generated").mkdir()
        self.data = {"counts": COUNTS, "cells": [
            {"row": row, "col": col, "pose": "base"}
            for row, count in enumerate(COUNTS) for col in range(count)
        ]}
        self.pose("base")

    def pose(self, name, mode="RGBA", size=(132, 164), empty=False):
        image = Image.new(mode, size)
        if not empty:
            image.paste((37, 81, 125, 128) if mode == "RGBA" else (37, 81, 125), (20, 10, 90, 151))
            image.putpixel((0, 0), (9, 8, 7, 255) if mode == "RGBA" else (9, 8, 7))
        image.save(self.root / "generated" / f"{name}.png")

    def manifest(self):
        path = self.root / "pose-map.json"
        path.write_text(json.dumps(self.data), encoding="utf-8")
        return path

    def build(self):
        spec = importlib.util.spec_from_file_location("lantern_pack", PACKER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.build_sheet(self.manifest())

    def test_pixels_holds_tails_geometry_and_idle_height(self):
        self.pose("tall", empty=True)
        image = Image.open(self.root / "generated/tall.png").copy()
        image.paste((1, 2, 3, 255), (40, 3, 80, 160))
        image.save(self.root / "generated/tall.png")
        self.data["cells"][2]["pose"] = "tall"
        sheet, report = self.build()
        self.assertEqual(sheet.size, (1188, 2952))
        self.assertEqual(sheet.mode, "RGBA")
        self.assertEqual(report["count"], 108)
        self.assertEqual(report["bodyH"], 157)
        self.assertEqual((report["frameW"], report["frameH"]), (132, 164))
        original = Image.open(self.root / "generated/base.png")
        for row, count in enumerate(COUNTS):
            for col in range(9):
                cell = sheet.crop((col * 132, row * 164, (col + 1) * 132, (row + 1) * 164))
                if col >= count:
                    self.assertIsNone(cell.getchannel("A").getbbox())
                elif (row, col) != (0, 2):
                    self.assertEqual(cell.tobytes(), original.tobytes())
        self.assertEqual(report["rows"][0]["bounds"][2], [40, 3, 80, 160])

    def test_rejects_missing_empty_non_rgba_and_wrong_size(self):
        for kind in ("missing", "empty", "rgb", "size"):
            with self.subTest(kind=kind):
                path = self.root / "generated/base.png"
                path.unlink(missing_ok=True)
                if kind != "missing":
                    self.pose("base", mode="RGB" if kind == "rgb" else "RGBA",
                              size=(130, 161) if kind == "size" else (132, 164), empty=kind == "empty")
                with self.assertRaises(ValueError):
                    self.build()
                if not path.exists():
                    self.pose("base")

    def test_rejects_incomplete_duplicate_and_wrong_count_maps(self):
        original = list(self.data["cells"])
        for cells in (original[:-1], original[:-1] + [original[0]]):
            self.data["cells"] = cells
            with self.assertRaises(ValueError):
                self.build()
        self.data["cells"] = original
        self.data["counts"] = COUNTS[:-1] + [7]
        with self.assertRaises(ValueError):
            self.build()

    def test_cli_outputs_stay_beside_manifest(self):
        result = subprocess.run([sys.executable, "-B", str(PACKER), "--pose-map", str(self.manifest())],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.root / "candidate.png").is_file())
        report = json.loads((self.root / "report.json").read_text())
        self.assertEqual(report["count"], 108)


if __name__ == "__main__":
    unittest.main()
