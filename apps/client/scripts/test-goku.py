"""Candidate-only Goku packing checks: python apps/client/scripts/test-goku.py."""
import hashlib
import importlib.util
import io
from pathlib import Path
import unittest

import numpy as np
from PIL import Image
from scipy import ndimage


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SharedRegistrationTests(unittest.TestCase):
    def test_explicit_configuration_preserves_naruto_registration(self):
        pack = load_script("pack-naruto")
        row = pack.CONFIG["rows"][0]
        frames = pack.extract_row(row, config=pack.CONFIG, source_dir=pack.SOURCE_DIR)
        frame, details = frames[0]
        default, _ = pack.register_frame(frame, details, row["family"])
        explicit, _ = pack.register_frame(frame, details, row["family"],
                                          config=pack.CONFIG, cell=pack.CELL, anchor=pack.ANCHOR)
        self.assertEqual(default.tobytes(), explicit.tobytes())


class GokuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_script("pack-goku")
        cls.sheet, cls.records = cls.pack.build_sheet()

    def cell(self, row, col):
        return self.sheet.crop((col * 146, row * 159, (col + 1) * 146, (row + 1) * 159))

    def test_population_distinct_poses_and_gutters(self):
        self.assertEqual(self.sheet.mode, "RGBA")
        self.assertEqual(self.sheet.size, (1314, 2862))
        counts = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]
        self.assertEqual(len(self.records), 108)
        poses = set()
        for row, count in enumerate(counts):
            for col in range(9):
                cell = self.cell(row, col)
                alpha = np.array(cell)[:, :, 3]
                if col >= count:
                    self.assertFalse(alpha.any(), (row, col))
                    continue
                self.assertGreater(np.count_nonzero(alpha >= 128), 500, (row, col))
                self.assertFalse(alpha[0].any(), (row, col))
                self.assertFalse(alpha[-2:].any(), (row, col))
                self.assertFalse(alpha[:, 0].any(), (row, col))
                self.assertFalse(alpha[:, -1].any(), (row, col))
                poses.add(cell.tobytes())
        self.assertEqual(len(poses), 108, "Authored poses must not be duplicated")

    def test_fixed_scales_registration_and_immutable_sources(self):
        for name, source in self.pack.CONFIG["sources"].items():
            path = self.pack.SOURCE_DIR / source["file"]
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), source["sha256"], name)
        for record in self.records:
            self.assertEqual(record["target_anchor"], [71.5, 153])
            self.assertEqual(record["scale"], self.pack.CONFIG["scales"][record["family"]])
            self.assertLessEqual(abs(record["registered_anchor"][0]
                                     - record["horizontal_fit_shift"] - 71.5), 0.51)
            self.assertLessEqual(abs(record["registered_anchor"][1] - 153), 0.51)
        pixels = np.array(self.sheet)
        self.assertFalse(pixels[pixels[:, :, 3] == 0, :3].any())

    def test_candidate_is_reproducible(self):
        output = io.BytesIO()
        self.pack.engine.save_png(self.sheet, output)
        self.assertEqual(self.pack.OUTPUT.read_bytes(), output.getvalue())
        self.assertEqual(self.pack.OUTPUT.name, "goku-candidate.png")

    def test_registered_runtime_matches_reviewed_candidate(self):
        output = io.BytesIO()
        self.pack.engine.save_png(self.sheet, output)
        production = self.pack.ROOT / "apps/client/public/sprites/goku.png"
        self.assertEqual(production.read_bytes(), output.getvalue())

    def test_broader_native_chest_with_preserved_height(self):
        with Image.open(self.pack.SOURCE_DIR / "original-atlas.png") as original:
            old = np.array(original.crop((0, 0, 146, 159)))
        new = np.array(self.cell(0, 0))

        def chest_width(pixels):
            widths = []
            for y in range(80, 95):
                xs = np.flatnonzero(pixels[y, :, 3] >= 128)
                if len(xs):
                    widths.append(int(xs[-1] - xs[0] + 1))
            return float(np.median(widths))

        self.assertGreaterEqual(chest_width(new), chest_width(old) * 1.2)
        old_y = np.where(old[:, :, 3] >= 128)[0]
        new_y = np.where(new[:, :, 3] >= 128)[0]
        self.assertLessEqual(abs(int(new_y.max() - new_y.min())
                                 - int(old_y.max() - old_y.min())), 4)
        self.assertEqual(self.pack.CONFIG["runtime_contract"]["bodyHeight"], 148)

    def test_complete_source_core_preserved_without_duplication(self):
        for name in self.pack.CONFIG["sources"]:
            source = self.pack.engine.read_source(name, config=self.pack.CONFIG,
                                                  source_dir=self.pack.SOURCE_DIR)
            labels, _ = ndimage.label(source[:, :, 3] >= 32, np.ones((3, 3)))
            sizes = np.bincount(labels.ravel())
            core = (labels > 0) & (sizes[labels] >= 600)
            covered = np.zeros(core.shape, dtype=bool)
            for row in (r for r in self.pack.CONFIG["rows"] if r["source"] == name):
                for frame, details in self.pack.engine.extract_row(
                        row, config=self.pack.CONFIG, source_dir=self.pack.SOURCE_DIR):
                    x0, y0, x1, y1 = details["source_box"]
                    pixels = np.array(frame)
                    retained = pixels[:, :, 3] > 0
                    self.assertTrue(np.array_equal(pixels[retained], source[y0:y1, x0:x1][retained]))
                    coverage = covered[y0:y1, x0:x1]
                    self.assertFalse((coverage & (pixels[:, :, 3] >= 32)).any())
                    coverage |= pixels[:, :, 3] >= 32
            self.assertTrue(covered[core].all(), f"Lost authored source core: {name}")


if __name__ == "__main__":
    unittest.main()
