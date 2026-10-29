"""Synthetic contract checks; no downloaded art or production writes required."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw


class ApprovedTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("approved", Path(__file__).with_name("pack-goku-approved.py"))
        self.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.pack)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for index in range(10):
            image = Image.new("RGBA", (148, 148))
            ImageDraw.Draw(image).rectangle((44 + index % 2, 22, 103, 125), fill=(120 + index, 40, 20, 255))
            image.save(self.root / f"{index}.png")
        self.data = {"version": 1, "source_root": ".", "rows": [
            {"name": name, "pivot": [74, 126], "frames": [f"{i}.png" for i in range(count)]}
            for name, count in zip(self.pack.ROW_NAMES, self.pack.COUNTS)],
            "lobby": {"pivot": [74, 126], "frames": [f"{i}.png" for i in range(1, 8)]}}

    def build(self):
        path = self.root / "manifest.json"
        path.write_text(json.dumps(self.data), encoding="utf-8")
        return self.pack.build(path)

    def test_geometry_exact_idle_hold_and_relative_placement(self):
        gameplay, lobby, report = self.build()
        self.assertEqual(gameplay.size, (1314, 3456))
        self.assertEqual(self.pack.ANCHOR, (71.5, 186))
        self.assertEqual(lobby.size, (2048, 207))
        self.assertEqual(len(report["gameplay"]), 108)
        idle = gameplay.crop((0, 0, 146, 192))
        expected = Image.new("RGBA", (128, 207))
        expected.paste(idle, (-8, 8))
        for index in (0, 14, 15):
            self.assertEqual(lobby.crop((index * 128, 0, (index + 1) * 128, 207)).tobytes(), expected.tobytes())
        self.assertGreater(report["gameplay"][1]["bounds"][0], report["gameplay"][0]["bounds"][0])
        self.assertIsNone(gameplay.crop((4 * 146, 0, 5 * 146, 192)).getbbox())

    def test_reference_selection(self):
        row = self.data["rows"][6]
        row.update(frames=[f"{i}.png" for i in range(7)], indices=list(range(1, 7)), reference_index=0)
        self.build()
        row["indices"] = list(range(6))
        with self.assertRaisesRegex(ValueError, "reference"):
            self.build()

    def test_overflow_blank_count_canvas_and_paths_fail(self):
        for field, value, message in (("pivot", [0, 0], "overflow"), ("frames", ["0.png"], "count"),
                                      ("frames", [f"../escape{i}.png" for i in range(4)], "source_root")):
            with self.subTest(field=field, value=value):
                original = self.data["rows"][0][field]
                self.data["rows"][0][field] = value
                with self.assertRaisesRegex(ValueError, message):
                    self.build()
                self.data["rows"][0][field] = original
        Image.new("RGBA", (148, 148)).save(self.root / "0.png")
        with self.assertRaisesRegex(ValueError, "blank"):
            self.build()
        Image.new("RGBA", (61, 104), "red").save(self.root / "0.png")
        with self.assertRaisesRegex(ValueError, "unsupported native"):
            self.build()

    def test_cast_reference_required_and_duplicate_pixels_rejected(self):
        row = self.data["rows"][8]
        row.update(frames=[f"{i}.png" for i in range(10)], indices=list(range(1, 10)), reference_index=0)
        with self.assertRaisesRegex(ValueError, "reference must be retained"):
            self.build()
        row["indices"] = list(range(9))
        self.build()
        (self.root / "1.png").write_bytes((self.root / "0.png").read_bytes())
        with self.assertRaisesRegex(ValueError, "duplicate authored pixels"):
            self.build()

    def test_excluded_reference_determines_shared_pivot(self):
        row = self.data["rows"][6]
        row.pop("pivot")
        row.update(frames=[f"{i}.png" for i in range(7)], indices=list(range(1, 7)),
                   reference_index=0, anchor_frame="0.png")
        _, _, report = self.build()
        records = [r for r in report["gameplay"] if r["row"] == 6]
        self.assertTrue(all(r["pivot"] == [74, 126] for r in records))
        self.assertEqual(len({tuple(r["offset"]) for r in records}), 1)
        self.assertEqual(records[0]["source_index"], 1)
        self.assertEqual(records[0]["anchor_frame"], "0.png")
        self.assertNotEqual(records[0]["bounds"][0], records[1]["bounds"][0])

    def test_lobby_reference_zero_selects_two_through_eight(self):
        self.data["lobby"] = {"frames": [f"{i}.png" for i in range(9)],
                              "indices": list(range(2, 9)), "reference_index": 0, "anchor_frame": "0.png"}
        gameplay, lobby, report = self.build()
        self.assertEqual([r["source_index"] for r in report["lobby"]], list(range(2, 9)))
        expected = Image.new("RGBA", self.pack.LOBBY_CELL)
        expected.paste(gameplay.crop((0, 0, 146, 192)), (-8, 8))
        self.assertEqual(lobby.crop((0, 0, 128, 207)).tobytes(), expected.tobytes())

    def test_native_template_rows_share_scale_with_v3(self):
        for index in range(6):
            image = Image.new("RGBA", (60, 104))
            ImageDraw.Draw(image).rectangle((5, 1, 54, 102), fill=(120 + index, 40, 20, 255))
            image.save(self.root / f"native{index}.png")
        for row, count in zip(self.data["rows"][:6], (4, 4, 4, 6, 6, 6)):
            row.pop("pivot")
            row.update(frames=[f"native{i}.png" for i in range(count)], anchor_frame="native0.png")
        _, _, report = self.build()
        self.assertEqual(report["gameplay"][0]["source_size"], (60, 104))
        self.assertEqual(report["nominal_scale"], 140 / 104)
        self.assertEqual(report["gameplay"][0]["pivot"], [30, 103])

    def test_diagnostic_exports_leave_sources_unchanged(self):
        original = (self.root / "0.png").read_bytes()
        gameplay, lobby, _ = self.build()
        for name, image, cell, counts in (("game", gameplay, self.pack.CELL, self.pack.COUNTS),
                                          ("lobby", lobby, self.pack.LOBBY_CELL, (16,))):
            prefix = self.root / name
            self.pack.diagnostics(image, cell, counts, prefix)
            with Image.open(str(prefix) + "-preview.gif") as preview:
                self.assertGreater(preview.n_frames, 1)
            self.assertTrue(Path(str(prefix) + "-contact.png").is_file())
        self.assertEqual((self.root / "0.png").read_bytes(), original)

    def test_corrected_128_canvas_preserves_pose_offsets_with_v3_lobby(self):
        pivot = [13 + 71.5 * .7, 9 + 153 * .7]
        for index in range(9):
            image = Image.new("RGBA", (128, 128))
            ImageDraw.Draw(image).rectangle((42 + index % 2, 15, 83, 115), fill=(120 + index, 40, 20, 255))
            image.save(self.root / f"corrected{index}.png")
        for row, count in zip(self.data["rows"], self.pack.COUNTS):
            row.update(frames=[f"corrected{i}.png" for i in range(count)], pivot=pivot)
        _, lobby, report = self.build()
        records = report["gameplay"]
        self.assertEqual(len(records), 108)
        self.assertEqual(records[0]["source_size"], (128, 128))
        self.assertEqual(records[0]["pivot"], pivot)
        self.assertEqual(len({tuple(r["offset"]) for r in records}), 1)
        self.assertNotEqual(records[0]["bounds"][0], records[1]["bounds"][0])
        self.assertEqual(report["lobby"][0]["source_size"], (148, 148))
        self.assertEqual(lobby.size, (2048, 207))

    def test_manifest_global_scale_supports_tall_canvas(self):
        self.data.update(scale=1.10, scale_basis="104px crown-to-feet plus raised hands; measured 125px union")
        for index in range(9):
            image = Image.new("RGBA", (128, 160))
            ImageDraw.Draw(image).rectangle((42, 24, 83, 147), fill=(120 + index, 40, 20, 255))
            image.save(self.root / f"tall{index}.png")
        for row, count in zip(self.data["rows"], self.pack.COUNTS):
            row.update(frames=[f"tall{i}.png" for i in range(count)], pivot=[64, 148])
        _, _, report = self.build()
        self.assertEqual(report["nominal_scale"], 1.10)
        self.assertEqual(report["gameplay"][0]["source_size"], (128, 160))
        self.assertEqual(report["lobby"][0]["axis_scales"], (round(148 * 1.10) / 148,) * 2)
        self.data.pop("scale_basis")
        with self.assertRaisesRegex(ValueError, "scale_basis"):
            self.build()


if __name__ == "__main__":
    unittest.main()
