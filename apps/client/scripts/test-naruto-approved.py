"""Small synthetic fixtures; never promotes production artwork.

Run: python -B apps/client/scripts/test-naruto-approved.py
"""
import importlib.util
import contextlib
import io
import json
import hashlib
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image


SCRIPT = Path(__file__).with_name("pack-naruto-approved.py")


class ApprovedPackingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("approved_packer", SCRIPT)
        cls.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.pack)

    def fixture(self):
        pixels = np.zeros((32, 48, 4), dtype=np.uint8)
        pixels[:, :, :3] = [17, 18, 19]  # Hidden RGB must not escape cleanup.
        pixels[4:12, 4:8] = [40, 60, 90, 255]
        pixels[4:12, 29:33] = [50, 70, 100, 180]
        pixels[20:24, 5:15] = [60, 80, 110, 255]  # Horizontal death pose.
        pixels[20:23, 30:42] = [70, 90, 120, 255]
        pixels[3, 4:8] = [200, 201, 202, 127]  # Fringe, not new paint.
        pixels[15, 20] = [255, 0, 0, 255]  # Detached speck.
        return Image.fromarray(pixels)

    def family(self):
        return {"name": "reaction", "rows": [{"row": 6, "count": 2}, {"row": 7, "count": 2}]}

    def extract(self, image=None, overrides=None):
        return self.pack.extract_family(image or self.fixture(), self.family(),
                                        overrides=overrides, minimum_pixels=8)

    def test_count_and_precise_source_boxes(self):
        rows = self.extract()
        self.assertEqual([[p[1]["source_box"] for p in row] for row in rows],
                         [[[4, 4, 8, 12], [29, 4, 33, 12]],
                          [[5, 20, 15, 24], [30, 20, 42, 23]]])

    def test_count_mismatch_fails_instead_of_repeating(self):
        pixels = np.array(self.fixture())
        pixels[20:23, 30:42] = 0
        with self.assertRaisesRegex(ValueError, "count"):
            self.extract(Image.fromarray(pixels))

    def test_source_edge_clipping_is_rejected(self):
        pixels = np.array(self.fixture())
        pixels[4:12, 0:8] = [40, 60, 90, 255]
        with self.assertRaisesRegex(ValueError, "clipp"):
            self.extract(Image.fromarray(pixels))

    def test_rough_cell_crossing_keeps_whole_pose(self):
        pixels = np.array(self.fixture())
        pixels[4:12, 29:33] = 0
        pixels[4:12, 22:27] = [50, 70, 100, 255]
        self.assertEqual(self.extract(Image.fromarray(pixels))[0][1][1]["source_box"], [22, 4, 27, 12])

    def test_measured_boxes_override_row_assignment_without_cutting(self):
        boxes = {"source_boxes": {"6": [[3, 3, 9, 13], [28, 3, 34, 13]],
                                   "7": [[4, 19, 16, 25], [29, 19, 43, 24]]}}
        self.assertEqual(self.extract(overrides=boxes)[1][0][1]["source_box"], [5, 20, 15, 24])
        boxes["source_boxes"]["6"][0] = [5, 3, 9, 13]
        with self.assertRaisesRegex(ValueError, "clipp"):
            self.extract(overrides=boxes)

    def test_cleanup_is_binary_and_preserves_source_rgb(self):
        rows = self.extract()
        source = np.array(self.fixture())
        for row in rows:
            for image, record in row:
                pixels = np.array(image)
                self.assertTrue(set(np.unique(pixels[:, :, 3])) <= {0, 255})
                self.assertFalse(pixels[pixels[:, :, 3] == 0].any())
                x0, y0, x1, y1 = record["source_box"]
                opaque = pixels[:, :, 3] == 255
                self.assertTrue(np.array_equal(pixels[:, :, :3][opaque], source[y0:y1, x0:x1, :3][opaque]))

    def test_alpha_254_body_and_hidden_background_rgb_are_accepted(self):
        pixels = np.array(self.fixture())
        pixels[pixels[:, :, 3] >= 128, 3] = 254
        rows = self.extract(Image.fromarray(pixels))
        self.assertEqual(len(rows[0]), 2)
        self.assertEqual(rows[0][0][0].getchannel("A").getextrema(), (255, 255))

    def test_measured_boxes_cannot_duplicate_or_ignore_substantial_art(self):
        boxes = {"source_boxes": {"6": [[3, 3, 9, 13], [3, 3, 9, 13]]}}
        with self.assertRaisesRegex(ValueError, "Duplicate|unassigned"):
            self.extract(overrides=boxes)

    def test_substantial_extra_component_is_not_silently_removed(self):
        pixels = np.array(self.fixture())
        pixels[5:8, 17:20] = [255, 10, 20, 255]
        with self.assertRaisesRegex(ValueError, "count"):
            self.extract(Image.fromarray(pixels))

    def test_reactions_share_one_scale_without_normalizing_dead_poses(self):
        frames, scale = self.pack.register_family(self.extract(), self.family(), target_height=8)
        self.assertEqual(scale, 1)
        self.assertEqual([r["scale"] for _, r in frames], [1, 1, 1, 1])
        self.assertEqual([im.getbbox()[3] - im.getbbox()[1] for im, _ in frames], [8, 8, 4, 3])
        self.assertTrue(all(r["registered_anchor"] == [48, 124] for _, r in frames))

    def test_oversize_pose_fails_without_squashing(self):
        with self.assertRaisesRegex(ValueError, "fit|clipp"):
            self.pack.register_family(self.extract(), self.family(), target_height=109)

    def test_png_is_deterministic_and_does_not_mutate_input(self):
        source = self.fixture()
        before = source.tobytes()
        a = self.pack.register_family(self.extract(source), self.family(), target_height=8)[0][0][0]
        b = self.pack.register_family(self.extract(source), self.family(), target_height=8)[0][0][0]
        self.assertEqual(self.pack.png_bytes(a), self.pack.png_bytes(b))
        self.assertEqual(source.tobytes(), before)

    def test_full_contract_has_108_frames_and_empty_tails(self):
        contract = {"frame": [96, 128], "anchor": [48, 124], "families": []}
        counts = [4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8]
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            for row, count in enumerate(counts):
                name = "walk" if row == 3 else f"fixture-{row}"
                contract["families"].append({"name": name, "rows": [{"row": row, "count": count}]})
                pixels = np.zeros((120, count * 40, 4), dtype=np.uint8)
                for col in range(count):
                    pixels[4:113, col * 40 + 10:col * 40 + 30] = [20 + col, 60, 90, 255]
                if row == 0:
                    pixels[4, 10] = [210, 20, 30, 255]
                Image.fromarray(pixels).save(directory / f"{name}.generated.png")
            atlas, report = self.pack.build_sheet(directory, contract, minimum_pixels=8)
            self.assertEqual(atlas.size, (864, 2304))
            self.assertEqual(len(report["frames"]), 108)
            self.assertEqual(report["sources"]["walk"]["target_height"], 109)
            for row, count in enumerate(counts):
                self.assertIsNone(atlas.crop((count * 96, row * 128, 864, (row + 1) * 128)).getbbox())
            self.assertEqual(self.pack.png_bytes(atlas), self.pack.png_bytes(self.pack.build_sheet(directory, contract, minimum_pixels=8)[0]))
            shorter, measured = self.pack.build_sheet(directory, contract, minimum_pixels=8,
                                                      manifest={"fixture-0": {"target_height": 104}})
            self.assertEqual(measured["sources"]["fixture-0"]["scale"], 104 / 109)
            self.assertEqual(shorter.crop((0, 0, 96, 128)).getbbox(), (38, 20, 57, 124))
            (directory / "contract.json").write_text(json.dumps(contract), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(self.pack.main(["--source-dir", str(directory), "--minimum-pixels", "8"]), 0)
            self.assertEqual((directory / "naruto-candidate.png").read_bytes(), self.pack.png_bytes(atlas))
            self.assertEqual(json.loads((directory / "report.json").read_text())["frame_count"], 108)
            review = {"atlas_sha256_before": report["atlas_sha256"],
                      "patches": [[38, 15, [210, 20, 30, 255], [27, 21, 17, 255]]]}
            (directory / "edge-cleanup.json").write_text(json.dumps(review), encoding="utf-8")
            cleaned, replay = self.pack.build_sheet(directory, contract, minimum_pixels=8)
            self.assertEqual(cleaned.getpixel((38, 15)), (27, 21, 17, 255))
            self.assertNotEqual(replay["frames"][0]["sha256"], report["frames"][0]["sha256"])
            self.assertEqual(replay["frames"][1:], report["frames"][1:])
            self.assertEqual(replay["atlas_sha256"], hashlib.sha256(self.pack.png_bytes(cleaned)).hexdigest())
            self.assertEqual(replay["edge_cleanup"]["atlas_sha256_after"], replay["atlas_sha256"])

    def test_cli_requires_write_for_public_promotion(self):
        public = self.pack.ROOT / "apps/client/public/sprites/naruto.png"
        before = public.read_bytes()
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            self.pack.main(["--output", str(public)])
        self.assertEqual(error.exception.code, 2)
        self.assertEqual(public.read_bytes(), before)

    def cleanup_fixture(self):
        pixels = np.zeros((8, 8, 4), dtype=np.uint8)
        pixels[1:7, 1:7] = [50, 60, 70, 255]
        pixels[2, 2] = [210, 20, 30, 255]
        image = Image.fromarray(pixels)
        review = {"atlas_sha256_before": hashlib.sha256(self.pack.png_bytes(image)).hexdigest(),
                  "patches": [[2, 2, [210, 20, 30, 255], [27, 21, 17, 255]]]}
        return image, review

    def test_reviewed_cleanup_changes_only_exact_pixel_and_preserves_alpha(self):
        image, review = self.cleanup_fixture()
        before = image.tobytes()
        result, audit = self.pack.apply_edge_cleanup(image, review)
        self.assertEqual(result.getpixel((2, 2)), (27, 21, 17, 255))
        self.assertEqual(image.tobytes(), before)
        self.assertEqual(result.getchannel("A").tobytes(), image.getchannel("A").tobytes())
        self.assertEqual(int(np.any(np.array(result) != np.array(image), axis=2).sum()), 1)
        self.assertEqual(audit["patch_count"], 1)

    def test_reviewed_cleanup_rejects_wrong_hash_and_frozen_alpha_change(self):
        image, review = self.cleanup_fixture()
        review["atlas_sha256_before"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "hash"):
            self.pack.apply_edge_cleanup(image, review)
        image, review = self.cleanup_fixture()
        review["patches"][0][3][3] = 0
        with self.assertRaisesRegex(ValueError, "alpha"):
            self.pack.apply_edge_cleanup(image, review)

    def test_reviewed_cleanup_rejects_stale_pixel_duplicate_and_interior_red(self):
        image, review = self.cleanup_fixture()
        review["patches"][0][2][0] = 211
        with self.assertRaisesRegex(ValueError, "expected"):
            self.pack.apply_edge_cleanup(image, review)
        image, review = self.cleanup_fixture()
        review["patches"] *= 2
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.pack.apply_edge_cleanup(image, review)
        image, review = self.cleanup_fixture()
        image.putpixel((3, 3), (210, 20, 30, 255))
        review["atlas_sha256_before"] = hashlib.sha256(self.pack.png_bytes(image)).hexdigest()
        review["patches"][0][:2] = [3, 3]
        with self.assertRaisesRegex(ValueError, "edge"):
            self.pack.apply_edge_cleanup(image, review)


if __name__ == "__main__":
    unittest.main()
