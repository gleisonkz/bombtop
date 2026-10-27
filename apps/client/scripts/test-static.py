"""Production contracts for the approved 107-pose option4 Static atlas.

Synthetic packer edge cases live separately in test-static-approved.py.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np
from PIL import Image
from scipy import ndimage

SPEC = importlib.util.spec_from_file_location('pack_static_approved', Path(__file__).with_name('pack-static-approved.py'))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)
COUNTS = (4, 4, 4, 5, 4, 5, 6, 7, 6, 7, 4, 4, 4, 4, 6, 6, 6, 10, 11)


class StaticAtlasTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = PACK.SOURCE_DIR
        cls.contract = json.loads((cls.directory / 'contract.json').read_text())
        cls.manifest = json.loads((cls.directory / 'measurements.json').read_text())
        cls.image = Image.open(PACK.ROOT / 'apps/client/public/sprites/static-final.png').convert('RGBA')
        cls.rebuilt, cls.report = PACK.build_sheet(cls.directory, cls.contract, manifest=cls.manifest)

    def frame(self, row, column):
        return self.image.crop((column * 168, row * 224, (column + 1) * 168, (row + 1) * 224))

    def test_export_matches_native_grid_and_deterministic_rebuild(self):
        self.assertEqual(self.image.size, (2352, 4256))
        self.assertEqual(self.image.tobytes(), self.rebuilt.tobytes())
        second, report = PACK.build_sheet(self.directory, self.contract, manifest=self.manifest)
        self.assertEqual(PACK.png_bytes(second), PACK.png_bytes(self.rebuilt))
        self.assertEqual(report, self.report)

    def test_107_occupied_cells_unused_tails_alpha_and_gutters(self):
        self.assertEqual(tuple(PACK.COUNTS), COUNTS)
        self.assertEqual(self.report['frame_count'], 107)
        pixels = np.array(self.image)
        self.assertEqual(set(np.unique(pixels[:, :, 3])), {0, 255})
        self.assertFalse(pixels[pixels[:, :, 3] == 0].any())
        for row, count in enumerate(COUNTS):
            for column in range(14):
                bounds = self.frame(row, column).getbbox()
                if column >= count:
                    self.assertIsNone(bounds, (row, column))
                    continue
                self.assertIsNotNone(bounds, (row, column))
                left, top, right, bottom = bounds
                self.assertGreaterEqual(left, 1)
                self.assertGreaterEqual(top, 1)
                self.assertLessEqual(right, 167)
                self.assertEqual(bottom, 208 - (12 if (row, column) == (18, 6) else 0))

    def test_all_authored_phases_are_distinct_without_detached_electricity(self):
        drawings = set()
        for row, count in enumerate(COUNTS):
            for column in range(count):
                frame = self.frame(row, column)
                # Compare tight drawings too: translation alone is not an authored phase.
                drawing = frame.crop(frame.getbbox())
                digest = (drawing.size, hashlib.sha256(drawing.tobytes()).hexdigest())
                self.assertNotIn(digest, drawings, (row, column))
                drawings.add(digest)
                pixels = np.array(frame)
                rgb = pixels[:, :, :3].astype(int)
                cyan = (pixels[:, :, 3] > 0) & (rgb[:, :, 1] > 160) & (rgb[:, :, 2] > 160) & (rgb[:, :, 0] < 100)
                self.assertFalse(cyan.any(), (row, column, 'baked electricity'))
                labels, _ = ndimage.label(pixels[:, :, 3] > 0)
                areas = sorted(np.bincount(labels.ravel())[1:], reverse=True)
                self.assertTrue(all(area < 50 for area in areas[1:]), (row, column, areas))
        self.assertEqual(len(drawings), 107)

    def test_whole_families_keep_one_measured_scale_and_source_pixels(self):
        for family, source in self.report['sources'].items():
            self.assertAlmostEqual(source['scale'] * source['standing_height'], 148)
            frames = [f for f in self.report['frames'] if f['family'] == family]
            self.assertEqual({f['scale'] for f in frames}, {source['scale']})
            for record in frames:
                self.assertEqual(record['standing_height'], source['standing_height'])
                self.assertEqual(record['target_anchor'], [82, 208])
                left, top, right, bottom = record['source_box']
                for dimension, effective in zip((right - left, bottom - top), record['effective_scale']):
                    self.assertAlmostEqual(effective * dimension, round(dimension * source['scale']))
                frame = self.frame(record['row'], record['column'])
                self.assertEqual(hashlib.sha256(frame.tobytes()).hexdigest(), record['sha256'])

    def test_carry_hand_metadata_matches_visible_new_art(self):
        data = json.loads((PACK.ROOT / 'apps/client/src/render/carry-anchors.json').read_text())['characters']['static']
        self.assertEqual((data['frameW'], data['frameH']), (168, 224))
        for row in range(11, 17):
            anchors = data['rows'][str(row)]
            self.assertEqual(len(anchors), COUNTS[row])
            for column, anchor in enumerate(anchors):
                pixels = np.array(self.frame(row, column))
                for x in (anchor['x'] - anchor['span'] / 2, anchor['x'] + anchor['span'] / 2):
                    y = anchor['y']
                    self.assertTrue(0 <= x < 168 and 0 <= y < 224, (row, column, anchor))
                    # Palm anchors may sit in a gap between fingers; require nearby visible art.
                    patch = pixels[max(0, round(y) - 5):round(y) + 6, max(0, round(x) - 5):round(x) + 6, 3]
                    self.assertTrue(patch.any(), (row, column, anchor))

    def test_production_palette_protection_matches_new_drawings(self):
        data = json.loads((PACK.ROOT / 'apps/client/src/render/static-paint-regions.json').read_text())
        self.assertTrue(data == self.report['paint_regions'], 'Production protection must equal the option4 rebuild')
        self.assertEqual([len(row) for row in data['rows']], list(COUNTS))
        for row, columns in enumerate(data['rows']):
            for column, regions in enumerate(columns):
                self.assertTrue(regions, (row, column))
                for region in regions:
                    self.assertTrue(0 <= region['left'] < region['right'] <= 168)
                    self.assertTrue(0 <= region['top'] < region['bottom'] <= 224)

    def test_death_finishes_prone(self):
        left, top, right, bottom = self.frame(7, 6).getbbox()
        self.assertGreater(right - left, bottom - top)


if __name__ == '__main__':
    unittest.main()
