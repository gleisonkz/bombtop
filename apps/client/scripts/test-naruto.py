"""Production asset checks. Run: python apps/client/scripts/test-naruto.py."""
import hashlib
import importlib.util
import io
from pathlib import Path
import unittest

import numpy as np
from PIL import Image
from scipy import ndimage


SCRIPT = Path(__file__).with_name("pack-naruto.py")


class NarutoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCRIPT.exists():
            return
        spec = importlib.util.spec_from_file_location("pack_naruto", SCRIPT)
        cls.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.pack)
        cls.sheet, cls.records = cls.pack.build_sheet()

    def test_packer_exists(self):
        self.assertTrue(SCRIPT.exists(), "Deterministic Naruto packer is missing")

    def test_contract_population_and_empty_tail(self):
        if not SCRIPT.exists():
            self.skipTest("Packer not implemented")
        self.assertEqual(self.sheet.mode, "RGBA")
        self.assertEqual(self.sheet.size, (720, 2088))
        counts = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]
        self.assertEqual(len(self.records), 108)
        for row, count in enumerate(counts):
            for col in range(9):
                alpha = np.array(self.cell(row, col))[:, :, 3]
                with self.subTest(row=row, col=col):
                    if col < count:
                        self.assertGreater(np.count_nonzero(alpha >= 128), 500)
                    else:
                        self.assertFalse(alpha.any())

    def cell(self, row, col):
        return self.sheet.crop((col * 80, row * 116, (col + 1) * 80, (row + 1) * 116))

    def test_gutters_and_transparent_rgb(self):
        pixels = np.array(self.sheet)
        self.assertFalse(pixels[pixels[:, :, 3] == 0, :3].any())
        for record in self.records:
            alpha = np.array(self.cell(record["row"], record["column"]))[:, :, 3]
            with self.subTest(row=record["row"], col=record["column"]):
                self.assertFalse(alpha[0].any())
                self.assertFalse(alpha[-2:].any())
                self.assertFalse(alpha[:, 0].any())
                self.assertFalse(alpha[:, -1].any())

    def test_all_authored_walks_remain_distinct(self):
        for row in (3, 4, 5, 14, 15, 16):
            self.assertEqual(len({self.cell(row, col).tobytes() for col in range(6)}), 6, row)
        self.assertEqual(len({self.cell(r["row"], r["column"]).tobytes() for r in self.records}), 108)

    def test_foot_registration_and_fixed_family_scales(self):
        for record in self.records:
            with self.subTest(row=record["row"], col=record["column"]):
                self.assertEqual(record["target_anchor"], [40, 112])
                self.assertEqual(record["scale"], self.pack.CONFIG["scales"][record["family"]])
                alpha = np.array(self.cell(record["row"], record["column"]))[:, :, 3]
                ys, _ = np.where(alpha >= 128)
                self.assertLessEqual(abs(int(ys.max()) - 111), 1)
                self.assertLessEqual(abs(record["registered_anchor"][0]
                                         - record["horizontal_fit_shift"] - 40), 0.51)
                self.assertLessEqual(abs(record["registered_anchor"][1] - 112), 0.51)
                if record["row"] in (0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16, 17):
                    self.assertEqual(record["horizontal_fit_shift"], 0)

    def test_standing_scale_and_reviewed_overhang_exceptions(self):
        for row in (0, 1, 2, 11, 12, 13, 17):
            for record in (r for r in self.records if r["row"] == row):
                alpha = np.array(self.cell(row, record["column"]))[:, :, 3]
                ys, _ = np.where(alpha >= 128)
                self.assertIn(int(ys.max() - ys.min() + 1), range(108, 112), (row, record["column"]))
        shifts = [[r["row"], r["column"], r["horizontal_fit_shift"]]
                  for r in self.records if r["horizontal_fit_shift"]]
        self.assertEqual(shifts, self.pack.CONFIG["reviewed_horizontal_fit_shifts"])

    def test_source_hashes_and_core_alpha_are_preserved(self):
        for name, source in self.pack.CONFIG["sources"].items():
            path = self.pack.SOURCE_DIR / source["file"]
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), source["sha256"], name)
        for row in self.pack.CONFIG["rows"]:
            frames = self.pack.extract_row(row)
            self.assertEqual(len(frames), row["frames"])
            source = np.array(Image.open(self.pack.SOURCE_DIR / self.pack.CONFIG["sources"][row["source"]]["file"]))
            top, bottom = row["y_bounds"]
            labels, _ = ndimage.label(source[top:bottom, :, 3] >= 32, np.ones((3, 3)))
            sizes = np.bincount(labels.ravel())
            expected_core = np.count_nonzero((sizes[labels] >= 600) & (labels != 0))
            retained_core = 0
            covered = np.zeros(labels.shape, dtype=bool)
            for frame, details in frames:
                x0, y0, x1, y1 = details["source_box"]
                original = source[y0:y1, x0:x1]
                pixels = np.array(frame)
                retained = pixels[:, :, 3] > 0
                self.assertTrue(np.array_equal(pixels[retained], original[retained]))
                retained_core += np.count_nonzero(pixels[:, :, 3] >= 32)
                coverage = covered[y0 - top:y1 - top, x0:x1]
                self.assertFalse((coverage & (pixels[:, :, 3] >= 32)).any(), "Duplicated source core")
                coverage |= pixels[:, :, 3] >= 32
            # Dilated support can retain a few neighboring edge pixels, but no
            # pixel of any substantial authored component may disappear.
            self.assertGreaterEqual(retained_core, expected_core)
            self.assertTrue(covered[(sizes[labels] >= 600) & (labels != 0)].all(), "Lost authored core pixels")

    def test_repair_replaces_only_three_endpoints(self):
        repairs = {(r["row"], r["column"]) for r in self.records if r["source"] == "action-end"}
        self.assertEqual(repairs, {(8, 8), (9, 8), (10, 8)})
        repair_boxes = [r["source_box"] for r in self.records if r["source"] == "action-end"]
        self.assertEqual(sorted(b[0] for b in repair_boxes), [b[0] for b in repair_boxes])

    def test_png_export_is_reproducible(self):
        second, _ = self.pack.build_sheet()
        first_bytes, second_bytes = io.BytesIO(), io.BytesIO()
        self.pack.save_png(self.sheet, first_bytes)
        self.pack.save_png(second, second_bytes)
        self.assertEqual(first_bytes.getvalue(), second_bytes.getvalue())
        self.assertEqual(self.pack.OUTPUT.relative_to(self.pack.ROOT).as_posix(), ".agent/naruto-candidate.png")
        if self.pack.OUTPUT.exists():
            self.assertEqual(self.pack.OUTPUT.read_bytes(), first_bytes.getvalue())

    def test_registered_runtime_atlas_matches_reviewed_drawings(self):
        expected = io.BytesIO()
        self.pack.save_png(self.sheet, expected)
        production = self.pack.ROOT / "apps/client/public/sprites/naruto.png"
        self.assertEqual(production.read_bytes(), expected.getvalue())


if __name__ == "__main__":
    unittest.main()
