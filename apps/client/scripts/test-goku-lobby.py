"""Verify the approved broader Goku transformation and exact gameplay rest hold."""
import hashlib
import importlib.util
import io
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

SPEC = importlib.util.spec_from_file_location("pack_goku_lobby", Path(__file__).with_name("pack-goku-lobby.py"))
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)
APPROVED_SHA256 = "4e6225f671415ebdde1be21c16a702ef9107b562c1b17f9a43bc00e79c8ff179"


class GokuLobbyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with Image.open(PACK.OUTPUT) as image:
            cls.sheet = image.convert("RGBA")
        cls.frames = [cls.sheet.crop((i * 128, 0, (i + 1) * 128, 207)) for i in range(16)]

    def test_immutable_sources_and_shared_generated_scale(self):
        PACK.verify_sources()
        self.assertEqual(PACK.SCALE, 0.34)
        self.assertEqual(PACK.CONFIG["resampling"], "NEAREST")
        self.assertEqual(PACK.CONFIG["base"]["scale"], 142 / 148)
        self.assertEqual(len(PACK.CONFIG["poses"]), 8)
        self.assertEqual([p["hair"] for p in PACK.CONFIG["poses"]], ["black"] * 4 + ["gold"] * 4)

    def test_structural_contract_reproducible_approved_candidate_and_runtime(self):
        self.assertEqual(self.sheet.size, (2048, 207))
        output = io.BytesIO()
        PACK.build_sheet().save(output, format="PNG")
        self.assertEqual(PACK.OUTPUT.read_bytes(), output.getvalue())
        self.assertEqual(hashlib.sha256(output.getvalue()).hexdigest(), APPROVED_SHA256)
        runtime = PACK.ROOT / "apps/client/public/sprites/goku-lobby.png"
        self.assertEqual(runtime.read_bytes(), output.getvalue())

    def test_actual_gameplay_idle_pixels_after_declared_nearest_scale(self):
        with Image.open(PACK.BASE) as source:
            idle = source.convert("RGBA").crop((0, 0, 146, 159))
        scale = 142 / 148
        resized = idle.resize((round(146 * scale), round(159 * scale)), Image.Resampling.NEAREST)
        expected = Image.new("RGBA", (128, 207))
        expected.alpha_composite(resized, (round(64 - 71.5 * scale), round(194 - 153 * scale)))
        for index in (0, 14, 15):
            self.assertEqual(self.frames[index].tobytes(), expected.tobytes(), index)

    def test_all_seven_action_poses_use_exact_same_nearest_scale(self):
        with Image.open(PACK.SOURCE) as source:
            source = source.convert("RGBA")
            for index in range(1, 8):
                isolated, anchor = PACK.source_frame(source, index)
                size = tuple(round(d * 0.34) for d in isolated.size)
                resized = isolated.resize(size, Image.Resampling.NEAREST)
                expected = Image.new("RGBA", (128, 207))
                expected.alpha_composite(resized, (round(64 - anchor[0] * .34), round(194 - anchor[1] * .34)))
                self.assertEqual(expected.tobytes(), self.frames[index].tobytes(), index)

    def test_populated_alpha_gutters_and_cast_union(self):
        bounds = []
        for index, frame in enumerate(self.frames):
            pixels = np.asarray(frame)
            alpha = pixels[:, :, 3]
            self.assertGreater(np.count_nonzero(alpha > 64), 6000, index)
            for edge in (alpha[:2], alpha[-2:], alpha[:, :2], alpha[:, -2:]):
                self.assertFalse(edge.any(), index)
            self.assertFalse(pixels[alpha == 0, :3].any(), index)
            bounds.append(frame.getbbox())
        union = (min(b[0] for b in bounds), min(b[1] for b in bounds),
                 max(b[2] for b in bounds), max(b[3] for b in bounds))
        self.assertEqual(union, (22, 15, 107, 196))

    def test_boot_midpoints_and_new_ground_are_stable(self):
        for index, frame in enumerate(self.frames):
            p = np.asarray(frame).astype(float)
            blue = (p[:, :, 2] > p[:, :, 0] * 1.25) & (p[:, :, 2] > p[:, :, 1] * 1.05)
            blue &= p[:, :, 3] > 160
            blue[:177] = False
            _, xs = np.where(blue)
            self.assertGreater(len(xs), 30, index)
            self.assertLessEqual(abs((xs.min() + xs.max()) / 2 - 64), 1.5, index)
            # The blue highlight can end above the sole; measure actual dark boot
            # outlines for ground, excluding the surrounding yellow aura.
            sole = (p[:, :, 3] >= 128) & (p[:, :, :3].max(axis=2) < 110)
            sole[:185] = False
            sole[:, :27] = False
            sole[:, 101:] = False
            ys, _ = np.where(sole)
            self.assertGreater(len(ys), 20, index)
            self.assertLessEqual(abs(int(ys.max()) - 194), 2, index)

    def test_broader_torso_consistency_with_actual_gameplay(self):
        # Body colors omit the yellow aura. This band is above the clenched
        # fists, so natural elbow widening does not inflate chest measurements.
        def torso_width(frame):
            p = np.asarray(frame).astype(float)
            mask = (p[:, :, 3] > 160) & ((p[:, :, 2] > p[:, :, 0] * 1.25) |
                    ((p[:, :, 0] > 100) & (p[:, :, 1] < p[:, :, 0] * .75) &
                     (p[:, :, 2] < p[:, :, 0] * .8)))
            widths = []
            for row in mask[119:132]:
                xs = np.flatnonzero(row)
                if len(xs):
                    widths.append(int(xs[-1] - xs[0] + 1))
            return float(np.median(widths))
        reference = torso_width(self.frames[0])
        self.assertGreaterEqual(reference, 50)
        for index, frame in enumerate(self.frames[:8]):
            self.assertLessEqual(abs(torso_width(frame) / reference - 1), .15, index)

    def test_black_gold_black_phase_and_exact_reverse_playback(self):
        expected = (0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0, 0)
        self.assertEqual(PACK.PLAYBACK, expected)
        self.assertEqual(len({frame.tobytes() for frame in self.frames[:8]}), 8)
        for index, pose in enumerate(expected):
            self.assertEqual(self.frames[index].tobytes(), self.frames[pose].tobytes())
            hair = np.asarray(self.frames[index]).astype(float)[58:89, 43:85]
            gold = np.count_nonzero((hair[:, :, 0] > 140) & (hair[:, :, 1] > 90) &
                                    (hair[:, :, 2] < hair[:, :, 1] * .85) & (hair[:, :, 3] > 128))
            if pose < 4:
                self.assertLess(gold, 150, index)
            else:
                self.assertGreater(gold, 700, index)


if __name__ == "__main__":
    unittest.main()
