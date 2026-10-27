"""Synthetic regression coverage; no generated artwork or runtime writes required."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("optimus_packer", Path(__file__).with_name("pack-optimus-approved.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)
CONTRACT = Path(__file__).resolve().parents[3] / "concept/optimus/approved-redraw/contract.json"


def fixture(directory, contract):
    legacy = {"name": "cast", "rows": [{"row": r, "count": 9} for r in (8, 9, 10)]}
    transform = {"name": "transform", "rows": [{"row": r, "count": 3} for r in (8, 9, 10)]}
    families = [f for f in contract["families"] if f["name"] != "cast"] + [legacy, transform, PACK.TRUCK_FAMILY, PACK.FIST_FAMILY]
    for family in families:
        image = Image.new("RGBA", (900, 100 * len(family["rows"])))
        draw = ImageDraw.Draw(image)
        for band, row in enumerate(family["rows"]):
            for col in range(row["count"]):
                x, y = col * 100 + 12, band * 100 + 12
                width = 50 if family["name"] == "truck" else 24
                green = 100 if family["name"] == "transform" else 60
                draw.rectangle((x, y, x + width - 1, y + 49 + col % 2), fill=(40 + col * 10, green + band, 120, 128))
                draw.point((x + 3, y + 3), fill=(250, 100, 20, 255))
        image.save(directory / (family["name"] + ".generated.png"))


class OptimusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
        fixture(self.directory, self.contract)

    def build(self, **options):
        return PACK.build_assets(self.directory, self.contract, **options)

    def test_layout_counts_and_padding(self):
        assets, report = self.build()
        self.assertEqual({k: v.size for k, v in assets.items()}, {
            "optimus": (2688, 3808), "truck": (512, 288),
            "fist2": (448, 224), "optimus-menu16": (5120, 224)})
        self.assertEqual(len(report["gameplay"]["frames"]), 109)
        self.assertIsNone(assets["optimus"].crop((896, 0, 2688, 224)).getbbox())

    def test_binary_alpha_and_clean_transparency(self):
        assets, _ = self.build()
        for image in assets.values():
            self.assertLessEqual(set(image.getchannel("A").getdata()), {0, 255})
            self.assertTrue(all(p == (0, 0, 0, 0) for p in image.getdata() if p[3] == 0))

    def test_fixed_family_scale_and_first_height(self):
        _, report = self.build()
        for name in (f["name"] for f in self.contract["families"]):
            if name == "cast":
                continue  # Cast endpoints intentionally use exact idle/truck art.
            frames = [f for f in report["gameplay"]["frames"] if f["family"] == name]
            self.assertEqual(len({f["scale"] for f in frames}), 1)
            self.assertEqual(frames[0]["bbox"][3] - frames[0]["bbox"][1], 164)
            self.assertGreater(frames[1]["bbox"][3] - frames[1]["bbox"][1], 164)

    def test_actual_source_coordinates_and_hashes(self):
        _, report = self.build()
        self.assertEqual(report["gameplay"]["frames"][0]["source_box"], [12, 12, 36, 62])
        self.assertEqual(report["sources"]["idle"]["sha256"], hashlib.sha256((self.directory / "idle.generated.png").read_bytes()).hexdigest())

    def test_source_hash_lock(self):
        with self.assertRaisesRegex(ValueError, "sha256"):
            self.build(manifest={"idle": {"sha256": "wrong"}})

    def test_alpha_127_noise_is_discarded(self):
        image = Image.open(self.directory / "idle.generated.png").copy()
        ImageDraw.Draw(image).rectangle((70, 70, 85, 85), fill=(255, 0, 255, 127))
        image.save(self.directory / "idle.generated.png")
        assets, _ = self.build()
        self.assertNotIn((255, 0, 255, 255), set(assets["optimus"].getdata()))

    def test_source_edge_contact_is_rejected(self):
        image = Image.open(self.directory / "idle.generated.png").copy()
        ImageDraw.Draw(image).rectangle((0, 12, 35, 61), fill=(100, 100, 100, 255))
        image.save(self.directory / "idle.generated.png")
        with self.assertRaisesRegex(ValueError, "source clipping"):
            self.build()

    def test_imported_helpers_and_constants_remain_unchanged(self):
        before = (PACK.EXTRACTION.CELL, PACK.EXTRACTION.ANCHOR, list(PACK.EXTRACTION.COUNTS))
        self.assertIs(PACK.extract_family, PACK.EXTRACTION.extract_family)
        self.assertIs(PACK.components, PACK.EXTRACTION.components)
        self.assertIs(PACK.source_anchor, PACK.EXTRACTION.source_anchor)
        self.build()
        self.assertEqual(before, (PACK.EXTRACTION.CELL, PACK.EXTRACTION.ANCHOR, PACK.EXTRACTION.COUNTS))

    def test_exact_idle_truck_endpoints_and_declared_reverse(self):
        assets, report = self.build()
        atlas = assets["optimus"]
        for cast_row, idle_row, truck_row in ((8, 0, 1), (9, 1, 0), (10, 2, 2)):
            cells = [atlas.crop((col * 224, cast_row * 224, (col + 1) * 224, (cast_row + 1) * 224)) for col in range(12)]
            idle = atlas.crop((0, idle_row * 224, 224, (idle_row + 1) * 224))
            self.assertEqual(cells[0].tobytes(), idle.tobytes())
            for col in range(6):
                self.assertEqual(cells[col].tobytes(), cells[11 - col].tobytes())
            factor = 0.26 / 0.134
            for cast_col, truck_col in ((4, 1), (5, 0)):
                truck = assets["truck"].crop((truck_col * 128, truck_row * 96, (truck_col + 1) * 128, (truck_row + 1) * 96))
                box = truck.getbbox()
                resized = truck.crop(box).resize(tuple(round(v * factor) for v in (box[2] - box[0], box[3] - box[1])), Image.Resampling.NEAREST)
                self.assertEqual(cells[cast_col].crop(cells[cast_col].getbbox()).tobytes(), resized.tobytes())
                self.assertLessEqual(abs((cells[cast_col].getbbox()[3] - cells[cast_col].getbbox()[1]) * .134 - (box[3] - box[1]) * .26), .134)
            cast = [r for r in report["gameplay"]["frames"] if r["row"] == cast_row]
            self.assertEqual([r["column"] for r in cast], list(range(12)))
            self.assertEqual(cast[5]["truck_row"], truck_row)
            self.assertAlmostEqual(cast[5]["scale"], factor)
            self.assertEqual(len({r["sha256"] for r in cast}), 6)
            self.assertTrue(all(r["intentional_reverse"] for r in cast[6:]))
            self.assertEqual(len({r["scale"] for r in cast[1:4]}), 1)
            self.assertAlmostEqual(cast[1]["scale"], 164 / 50)
        self.assertNotIn("cast", report["sources"])
        with self.assertRaisesRegex(ValueError, "fixed_scale"):
            self.build(manifest={"transform": {"fixed_scale": -1}})
        _, explicit = self.build(manifest={"transform": {"fixed_scale": 3.0}})
        selected = [r for r in explicit["gameplay"]["frames"] if r["row"] in (8, 9, 10) and 1 <= r["column"] <= 3]
        self.assertEqual({r["scale"] for r in selected}, {3.0})

    def test_determinism_and_sources_immutable(self):
        before = {p.name: p.read_bytes() for p in self.directory.glob("*.png")}
        assets, first = self.build()
        again, second = self.build()
        self.assertEqual(first, second)
        for name in assets:
            self.assertEqual(PACK.png_bytes(assets[name]), PACK.png_bytes(again[name]))
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.directory.glob("*.png")})

    def test_contract_rejects_wrong_rows_and_geometry(self):
        for key, value in (("frame", [96, 128]), ("anchor", [112, 211]), ("target_body_height", 100)):
            contract = copy.deepcopy(self.contract)
            contract[key] = value
            with self.assertRaises(ValueError):
                PACK.build_assets(self.directory, contract)
        self.contract["families"][0]["rows"][0]["count"] = 5
        with self.assertRaises(ValueError):
            self.build()

    def test_missing_and_wrong_counts_fail(self):
        (self.directory / "fist.generated.png").unlink()
        with self.assertRaisesRegex(ValueError, "Missing"):
            self.build()
        fixture(self.directory, self.contract)
        Image.new("RGBA", (900, 300)).save(self.directory / "idle.generated.png")
        with self.assertRaises(ValueError):
            self.build()

    def test_overflow_fails_without_squashing(self):
        image = Image.open(self.directory / "idle.generated.png").copy()
        ImageDraw.Draw(image).rectangle((112, 12, 190, 61), fill=(100, 100, 100, 255))
        image.save(self.directory / "idle.generated.png")
        with self.assertRaisesRegex(ValueError, "fit|clipping"):
            self.build()

    def test_truck_fit_uses_entire_row(self):
        image = Image.open(self.directory / "truck.generated.png").copy()
        ImageDraw.Draw(image).rectangle((112, 12, 197, 61), fill=(100, 100, 100, 255))
        image.save(self.directory / "truck.generated.png")
        _, report = self.build()
        records = report["truck"]["frames"]
        for row in range(3):
            frames = [f for f in records if f["row"] == row]
            self.assertEqual(len({f["scale"] for f in frames}), 1)
            for frame in frames:
                x0, y0, x1, y1 = frame["bbox"]
                self.assertTrue(2 <= x0 < x1 <= 126)
                self.assertTrue(4 <= y0 < y1 <= 90)
        self.assertLess(records[0]["scale"], records[4]["scale"])

    def test_menu_no_fx_and_transform_sequence(self):
        assets, report = self.build()
        menu = assets["optimus-menu16"]
        frames = report["menu"]["frames"]
        self.assertEqual([f["kind"] for f in frames], ["robot"] * 4 + ["truck"] * 8 + ["robot"] * 2 + ["fist"] * 2)
        self.assertEqual([f["center_x"] for f in frames[4:12]], [160, 176, 232, 314, 430, -30, 70, 152])
        self.assertIsNone(menu.crop((8 * 320, 0, 9 * 320, 224)).getbbox())
        self.assertTrue(frames[8]["allow_offcard"])
        allowed = set()
        for name in ("optimus", "truck", "fist2"):
            allowed.update(assets[name].getdata())
        self.assertLessEqual(set(menu.getdata()), allowed)
        for index in (0, 1, 2, 3, 12, 13, 14, 15):
            self.assertIsNotNone(frames[index]["bbox"])

    def test_default_cli_candidates_only(self):
        (self.directory / "contract.json").write_text(json.dumps(self.contract))
        self.assertEqual(PACK.main(["--source-dir", str(self.directory), "--contact", "--gif"]), 0)
        for name in ("optimus", "truck", "fist2", "optimus-menu16"):
            self.assertTrue((self.directory / f"{name}-candidate.png").is_file())
        self.assertEqual(json.loads((self.directory / "report.json").read_text())["status"], "candidate; requires coordinator visual QA")
        for name, count in (("optimus", 12), ("truck", 4), ("fist2", 2), ("optimus-menu16", 16)):
            self.assertTrue((self.directory / f"{name}-contact.png").is_file())
            with Image.open(self.directory / f"{name}-preview.gif") as image:
                # GIF encoders coalesce identical adjacent poses; preserve timing.
                self.assertLessEqual(image.n_frames, count)
                duration = 0
                for index in range(image.n_frames):
                    image.seek(index)
                    duration += image.info["duration"]
                self.assertEqual(duration, count * 120)

    def test_raised_hands_preserve_helmet_height_and_measured_override(self):
        image = Image.new("RGBA", (100, 110))
        draw = ImageDraw.Draw(image)
        draw.rectangle((35, 10, 64, 109), fill="blue")
        draw.rectangle((5, 0, 15, 50), fill="red")
        draw.rectangle((15, 40, 35, 50), fill="red")
        details = {"row": 11, "column": 0, "source_box": [20, 30, 120, 140]}
        for name in ("carry-idle", "carry-walk", "fist"):
            frames = PACK.register([[(image, details), (image, {**details, "column": 1})]], {"name": name})
            for cell, record in frames:
                self.assertAlmostEqual(record["scale"], 1.64)
                self.assertEqual(record["scale_reference"]["source_box"], [55, 40, 85, 140])
                self.assertGreater(record["body_height"], 164)
                self.assertGreaterEqual(cell.getbbox()[1], 1)
            options = {"scale_reference_box": [55, 35, 85, 140]}
            explicit = PACK.register([[(image, details)]], {"name": name}, options=options)
            self.assertAlmostEqual(explicit[0][1]["scale"], 164 / 105)
            with self.assertRaisesRegex(ValueError, "scale_reference_box"):
                PACK.register([[(image, details)]], {"name": name}, options={"scale_reference_box": [0, 0, 2, 2]})


if __name__ == "__main__":
    unittest.main()
