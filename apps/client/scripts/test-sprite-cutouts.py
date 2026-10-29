"""Regression checks for reviewed cutout remnants in selection sprites."""
from pathlib import Path
import hashlib
import json
import unittest
from PIL import Image

SPRITES = Path(__file__).resolve().parents[1] / 'public/sprites'


class SpriteCutoutTests(unittest.TestCase):
    def test_only_reviewed_pixels_changed_and_geometry_is_preserved(self):
        manifest = json.loads(Path(__file__).with_name('sprite-cutout-patches.json').read_text())
        for asset in manifest['assets']:
            with self.subTest(asset=asset['file']), Image.open(SPRITES / asset['file']) as image:
                self.assertEqual(image.mode, 'RGBA')
                self.assertEqual(list(image.size), asset['size'])
                self.assertEqual(hashlib.sha256(image.tobytes()).hexdigest(), asset['repairedPixelsSha256'])
                original = image.copy()
                for x, y, before, after in asset['changes']:
                    self.assertEqual(list(image.getpixel((x, y))), after)
                    original.putpixel((x, y), tuple(before))
                self.assertEqual(hashlib.sha256(original.tobytes()).hexdigest(), asset['sourcePixelsSha256'])

    def test_goku_has_no_brown_hair_stalk(self):
        with Image.open(SPRITES / 'goku.png') as image:
            self.assertEqual(image.getpixel((203, 55)), (9, 9, 18, 255))

    def test_goku_raised_hands_keep_their_skin_colors(self):
        with Image.open(SPRITES / 'goku.png') as image:
            for frame in range(6):
                self.assertEqual(image.getpixel((frame * 132 + 43, 2695)), (233, 168, 132, 255))
                for x, y in ((85, 74), (86, 74), (86, 75)):
                    self.assertEqual(image.getpixel((frame * 132 + x, 2624 + y)), (195, 134, 103, 255))

    def test_lantern_crown_has_a_dark_outline(self):
        with Image.open(SPRITES / 'lantern.png') as image:
            self.assertLess(max(image.getpixel((77, 2806))[:3]), 70)

    def test_spider_has_no_floating_gray_square(self):
        with Image.open(SPRITES / 'spider.png') as image:
            for y in range(1064, 1066):
                for x in range(17, 19):
                    self.assertEqual(image.getpixel((x, y)), (0, 0, 0, 0))

    def test_panther_has_no_detached_neck_pixels(self):
        with Image.open(SPRITES / 'panther-lobby.png') as image:
            for frame in (4, 5, 6):
                for x, y in ((97, 116), (98, 116), (101, 119)):
                    self.assertEqual(image.getpixel((frame * 224 + x, y)), (0, 0, 0, 0))


if __name__ == '__main__':
    unittest.main()
