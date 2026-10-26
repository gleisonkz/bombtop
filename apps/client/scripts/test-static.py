"""Image contracts for the 2026-10-25 21:48 Super Choque integration."""
import importlib.util
import hashlib
import json
from pathlib import Path
import unittest
import numpy as np
from PIL import Image
from scipy import ndimage

SPEC = importlib.util.spec_from_file_location('pack_static', Path(__file__).with_name('pack-static.py'))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class StaticAtlasTests(unittest.TestCase):
    def test_redraw_preserves_all_rows_outside_carry_and_menu(self):
        directory = PACK.ROOT.parents[1] / 'concept/static/carry-redraw'
        contract = json.loads((directory / 'contract.json').read_text(encoding='utf-8'))
        image = Image.open(PACK.OUTPUT)
        for row, digest in contract['preservedRows'].items():
            strip = image.crop((0, int(row) * 186, 2352, (int(row) + 1) * 186))
            self.assertEqual(hashlib.sha256(strip.tobytes()).hexdigest(), digest, row)
        poses = set()
        for row in range(11, 17):
            for column in range(len(PACK.MAP[row][1])):
                frame = image.crop((column * 168, row * 186, (column + 1) * 168, (row + 1) * 186))
                poses.add(hashlib.sha256(frame.tobytes()).hexdigest())
        self.assertEqual(len(poses), 30, 'Carry must have thirty distinct authored drawings')

    def test_menu_disc_stays_thin_and_body_measurement_excludes_it(self):
        image = Image.open(PACK.OUTPUT)
        frame = np.array(image.crop((0, 17 * 186, 168, 18 * 186)))
        rgb = frame[:, :, :3].astype(int)
        yy = np.indices(frame.shape[:2])[0]
        board = (frame[:, :, 3] >= 128) & (yy >= 156) & (rgb.min(2) > 45) & (rgb.max(2) - rgb.min(2) < 65)
        y, x = np.where(board)
        self.assertLessEqual(int(y.max() - y.min() + 1), 16)
        self.assertLessEqual(int(x.max() - x.min() + 1), 96)
        self.assertEqual(frame[:, :, 3].nonzero()[0].min(), 17)
        # Authored boot contact at 159; body height is 159 - 17 = 142.
        self.assertGreater(np.count_nonzero(frame[154:160, 50:115, 3]), 100)

    def test_each_action_has_distinct_authored_frames_without_baked_effects(self):
        image = Image.open(PACK.OUTPUT)
        for row in (6, 7, 8, 9, 10, 17, 18):
            poses = []
            for column in range(len(PACK.MAP[row][1])):
                frame = np.array(image.crop((column * 168, row * 186, (column + 1) * 168, (row + 1) * 186)))
                poses.append(frame.tobytes())
                rgb = frame[:, :, :3].astype(int)
                cyan = (frame[:, :, 3] >= 128) & (rgb[:, :, 1] > 160) & (rgb[:, :, 2] > 160) & (rgb[:, :, 0] < 100)
                self.assertFalse(cyan.any(), (row, column, 'baked electricity'))
                labels, _ = ndimage.label(frame[:, :, 3] >= 64)
                areas = sorted(np.bincount(labels.ravel())[1:], reverse=True)
                self.assertTrue(all(area < 50 for area in areas[1:]), (row, column, 'detached effect'))
            self.assertEqual(len(set(poses)), len(poses), row)

    def test_source_inventory_has_all_99_distinct_poses(self):
        owners, rows = PACK.geometry()
        self.assertEqual(tuple(map(len, rows)), PACK.COUNTS)
        self.assertEqual(sum(map(len, rows)), 99)
        self.assertEqual(len(np.unique(owners)) - 1, 99)

    def test_protection_matches_the_packed_frames(self):
        rows = []
        PACK.build(rows)
        data = json.loads(PACK.PROTECTION.read_text(encoding='utf-8'))
        self.assertEqual(data, {'frameW': 168, 'frameH': 186, 'rows': rows})
        for row, (_, columns) in zip(rows, PACK.MAP):
            self.assertEqual(len(row), len(columns))
            for regions in row:
                self.assertTrue(regions)
                for region in regions:
                    self.assertTrue(0 <= region['left'] < region['right'] <= 168)
                    self.assertTrue(0 <= region['top'] < region['bottom'] <= 186)

    def test_isolation_keeps_source_rgb_and_alpha_inside_each_character(self):
        source = Image.open(PACK.SOURCE).convert('RGBA')
        owners, rows = PACK.geometry()
        for row in rows:
            for box, label in row:
                left, top, right, bottom = box
                mask = owners[top:bottom, left:right] == label
                original = np.array(source.crop(box))
                isolated = np.array(PACK.extract(source, box, mask))
                self.assertEqual(original.shape, isolated.shape)
                np.testing.assert_array_equal(isolated[mask], original[mask])
                self.assertFalse(np.any(isolated[~mask, 3]))

    def test_export_matches_native_grid_and_deterministic_rebuild(self):
        with Image.open(PACK.OUTPUT) as image:
            self.assertEqual(image.mode, 'RGBA')
            self.assertEqual(image.size, (2352, 3534))
            self.assertEqual(image.tobytes(), PACK.build().tobytes())

    def test_registered_cells_are_complete_and_unused_cells_are_empty(self):
        image = Image.open(PACK.OUTPUT)
        for row, (_, columns) in enumerate(PACK.MAP):
            for column in range(14):
                frame = image.crop((column * 168, row * 186, (column + 1) * 168, (row + 1) * 186))
                bounds = frame.getchannel('A').getbbox()
                if column >= len(columns):
                    self.assertIsNone(bounds, (row, column))
                    continue
                self.assertIsNotNone(bounds)
                self.assertGreater(bounds[0], 1)
                self.assertGreater(bounds[1], 1)
                self.assertLess(bounds[2], 167)
                self.assertEqual(bounds[3], PACK.ANCHOR[1] - (12 if (row, column) == (18, 6) else 0))
                labels, _ = ndimage.label(np.array(frame)[:, :, 3] >= 64)
                areas = sorted(np.bincount(labels.ravel())[1:], reverse=True)
                self.assertTrue(all(area < 50 for area in areas[1:]), (row, column, areas))

    def test_walking_keeps_the_standing_scale(self):
        image = Image.open(PACK.OUTPUT)
        heights = []
        for row in range(6):
            current = []
            for column in range(len(PACK.MAP[row][1])):
                frame = np.array(image.crop((column * 168, row * 186, (column + 1) * 168, (row + 1) * 186)))
                ys = np.where((frame[:, :, 3] >= 64).any(axis=1))[0]
                current.append(ys.max() - ys.min() + 1)
            heights.append(float(np.median(current)))
        self.assertLess(max(heights) / min(heights), 1.04, heights)

    def test_death_finishes_prone_instead_of_getting_up(self):
        image = Image.open(PACK.OUTPUT)
        frame = image.crop((6 * 168, 7 * 186, 7 * 168, 8 * 186))
        left, top, right, bottom = frame.getchannel('A').getbbox()
        self.assertGreater(right - left, bottom - top)

    def test_extract_preserves_black_and_partial_alpha(self):
        source = Image.new('RGBA', (20, 20))
        for x in range(5, 15):
            for y in range(5, 15):
                source.putpixel((x, y), (240, 180, 20, 128))
        source.putpixel((10, 10), (0, 0, 0, 254))
        frame = PACK.extract(source, (0, 0, 20, 20))
        self.assertEqual(frame.size, (10, 10))
        self.assertEqual(frame.getpixel((5, 5)), (0, 0, 0, 254))
        self.assertEqual(frame.getpixel((0, 0)), (240, 180, 20, 128))


if __name__ == '__main__':
    unittest.main()
