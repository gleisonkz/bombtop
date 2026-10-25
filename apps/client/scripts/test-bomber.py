"""Structural checks for the compiled Bomber art and its runtime exports."""
import importlib.util
import unittest
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("pack_bomber", Path(__file__).with_name("pack-bomber.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8, 9)


class BomberArtTests(unittest.TestCase):
    def test_master_preserves_native_hd_frame_resolution(self):
        with Image.open(PACK.SOURCE) as sheet:
            self.assertEqual(sheet.size, (1872, 5472))

    def test_enlarged_menu_previews_use_native_master_pixels(self):
        output = ROOT / "public/sprites/bomber-menu-atlas.png"
        with Image.open(PACK.SOURCE) as source, Image.open(output) as preview:
            self.assertEqual(preview.size, (1872, 5184))
            self.assertEqual(preview.tobytes(), source.crop((0, 0, 1872, 5184)).tobytes())
        self.assertLess(output.stat().st_size, 4 * 1024 * 1024, "Menu atlas must fit the existing PWA precache limit")

    def test_menu_frames_do_not_contain_detached_neighbor_fragments(self):
        with Image.open(PACK.SOURCE) as sheet:
            for col in range(9):
                frame = sheet.crop((col * 208, 18 * 288, (col + 1) * 208, 19 * 288))
                labels, _ = ndimage.label(np.asarray(frame.getchannel("A")) >= 32, structure=np.ones((3, 3)))
                areas = sorted(np.bincount(labels.ravel())[1:], reverse=True)
                self.assertTrue(areas, col)
                self.assertTrue(all(area <= 16 for area in areas[1:]), (col, areas))

    def test_carry_directions_keep_a_consistent_character_scale(self):
        with Image.open(PACK.SOURCE) as sheet:
            heights = []
            for row in range(11, 17):
                frame_heights = []
                for col in range(COUNTS[row]):
                    frame = sheet.crop((col * 208, row * 288, (col + 1) * 208, (row + 1) * 288))
                    box = frame.getchannel("A").getbbox()
                    frame_heights.append(box[3] - box[1])
                heights.append(median(frame_heights))
            self.assertLess(max(heights) / min(heights), 1.12, heights)

    def test_compiled_sheet_has_all_nineteen_animation_rows(self):
        with Image.open(PACK.SOURCE) as sheet:
            self.assertEqual(sheet.mode, "RGBA")
            self.assertEqual(sheet.size, (1872, 5472))
            for row, count in enumerate(COUNTS):
                frames = []
                for col in range(9):
                    frame = sheet.crop((col * 208, row * 288, (col + 1) * 208, (row + 1) * 288))
                    box = frame.getchannel("A").getbbox()
                    if col >= count:
                        self.assertIsNone(box, (row, col))
                        continue
                    self.assertIsNotNone(box, (row, col))
                    self.assertGreater(box[0], 0, (row, col))
                    self.assertGreater(box[1], 0, (row, col))
                    self.assertLess(box[2], 208, (row, col))
                    self.assertLess(box[3], 288, (row, col))
                    self.assertGreater(sum(value >= 32 for value in frame.getchannel("A").getdata()), 4000, (row, col))
                    frames.append(frame.tobytes())
                self.assertEqual(len(set(frames)), count, f"Duplicate poses in row {row}")

    def test_runtime_exports_are_reproducible_from_compiled_sheet(self):
        with Image.open(PACK.SOURCE) as source, Image.open(PACK.MENU_SOURCE) as menu:
            gameplay, title = PACK.export_sheets(source, menu)
        self.assertEqual(title.size, (768, 768))
        for name, expected in (("bomber-atlas.png", gameplay), ("bomber-title-fly.png", title)):
            with Image.open(ROOT / "public/sprites" / name) as actual:
                self.assertEqual(actual.size, expected.size)
                self.assertEqual(actual.tobytes(), expected.tobytes(), name)

    def test_hd_menu_has_padding_and_matches_compiled_inventory(self):
        with Image.open(PACK.SOURCE) as source, Image.open(PACK.MENU_SOURCE) as menu:
            for index in range(9):
                col, row = index % 3, index // 3
                frame = menu.crop((col * 384, row * 384, (col + 1) * 384, (row + 1) * 384))
                box = frame.getchannel("A").getbbox()
                self.assertGreaterEqual(min(box[0], box[1], 384 - box[2], 384 - box[3]), 16, index)
                inventory = source.crop((index * 208, 18 * 288 + 72, (index + 1) * 208, 19 * 288 - 8))
                expected = Image.new("RGBA", (208, 208))
                expected.alpha_composite(frame.resize((208, 208), Image.Resampling.LANCZOS))
                self.assertEqual(inventory.tobytes(), expected.tobytes(), index)


if __name__ == "__main__":
    unittest.main()
