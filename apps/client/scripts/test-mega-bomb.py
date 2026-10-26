"""Validate mega stage provenance, masks, and reproducible exports."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw


SPEC = importlib.util.spec_from_file_location("pack_mega_bomb", Path(__file__).with_name("pack-mega-bomb.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class MegaBombPipelineTests(unittest.TestCase):
    def setUp(self):
        self.original = Image.new("RGBA", (512, 512))
        ImageDraw.Draw(self.original).ellipse((150, 180, 350, 440), fill=(20, 30, 40, 255))
        self.sheet = Image.new("RGBA", (1024, 1024))
        draw = ImageDraw.Draw(self.sheet)
        for index in range(4):
            x, y = index % 2 * 512, index // 2 * 512
            draw.ellipse((x + 150, y + 180, x + 350, y + 440), fill=(80 + index * 40, 50, 20, 255))

    def test_original_armed_and_exact_row_major_crops(self):
        stages = PACK.build_stages(self.original, self.sheet)
        self.assertEqual(stages["armed"].tobytes(), self.original.tobytes())
        for index, stage in enumerate(PACK.STAGES[1:], start=1):
            x, y = index % 2 * 512, index // 2 * 512
            self.assertEqual(stages[stage].tobytes(), self.sheet.crop((x, y, x + 512, y + 512)).tobytes())

    def test_rejects_wrong_grid_mode_and_duplicate_states(self):
        for invalid in (self.sheet.resize((512, 512)), self.sheet.convert("RGB")):
            with self.assertRaises(ValueError):
                PACK.build_stages(self.original, invalid)
        duplicate = Image.new("RGBA", (1024, 1024))
        for index in range(4):
            duplicate.paste(self.original, (index % 2 * 512, index // 2 * 512))
        with self.assertRaises(ValueError):
            PACK.build_stages(self.original, duplicate)

    def test_flash_preserves_partial_alpha_and_bounds(self):
        self.original.putpixel((140, 200), (10, 20, 30, 127))
        flash = PACK.white_flash(self.original)
        self.assertEqual(flash.getchannel("A").tobytes(), self.original.getchannel("A").tobytes())
        self.assertEqual(flash.getchannel("A").getbbox(), self.original.getchannel("A").getbbox())
        self.assertEqual(flash.convert("RGB").getextrema(), ((255, 255),) * 3)

    def test_export_is_byte_reproducible(self):
        stages = PACK.build_stages(self.original, self.sheet)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            PACK.export_stages(stages, output)
            before = {path.name: path.read_bytes() for path in output.glob("*.png")}
            PACK.export_stages(stages, output)
            self.assertEqual(len(before), 8)
            self.assertEqual(before, {path.name: path.read_bytes() for path in output.glob("*.png")})


class MegaBombAssetTests(unittest.TestCase):
    def test_stage_bodies_keep_the_same_spherical_size(self):
        widths = []
        for stage in PACK.STAGES:
            with Image.open(PACK.OUTPUT / f"{stage}.png") as image:
                alpha = image.getchannel("A").tobytes()
                widths.append(max(sum(value >= 128 for value in alpha[row * 512:(row + 1) * 512]) for row in range(512)))
        self.assertLessEqual(max(widths) - min(widths), 3, widths)

    def test_committed_exports_match_sources_and_masks(self):
        with Image.open(PACK.SOURCE) as original, Image.open(PACK.STAGE_SOURCE) as sheet:
            stages = PACK.build_stages(original, sheet)
        for stage, expected in stages.items():
            alpha = expected.getchannel("A")
            bounds = alpha.getbbox()
            self.assertIsNotNone(bounds)
            self.assertEqual(alpha.getextrema(), (0, 255))
            self.assertGreater(bounds[0], 0)
            self.assertGreater(bounds[1], 0)
            self.assertLess(bounds[2], 512)
            self.assertLess(bounds[3], 512)
            for suffix, image in (("", expected), ("-white", PACK.white_flash(expected))):
                with self.subTest(stage=stage, variant=suffix):
                    with Image.open(PACK.OUTPUT / f"{stage}{suffix}.png") as actual:
                        self.assertEqual(actual.mode, "RGBA")
                        self.assertEqual(actual.size, (512, 512))
                        self.assertEqual(actual.tobytes(), image.tobytes())
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            PACK.export_stages(stages, output)
            for path in output.glob("*.png"):
                self.assertEqual(path.read_bytes(), (PACK.OUTPUT / path.name).read_bytes())


if __name__ == "__main__":
    unittest.main()
