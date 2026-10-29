"""Bounded synthetic checks for the A1 whole-native-cell packer."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image


SCRIPT = Path(__file__).with_name("pack-goku-a1.py")
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)


class A1Tests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.is_file(), "A1 packer is not implemented")
        spec = importlib.util.spec_from_file_location("goku_a1", SCRIPT)
        self.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.pack)
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        (self.root / "raw").mkdir()
        self.jobs = self.root / "jobs.json"
        self.rows = []
        for row, count in enumerate(COUNTS):
            poses = [f"r{row:02}-c{col:02}" for col in range(count)]
            self.rows.append(dict(row=row, direction="south", poses=poses, job_id=f"job-{row}"))
            for col, pose in enumerate(poses):
                image = Image.new("RGBA", (128, 160))
                image.putpixel((0, 0), (17, 18, 19, 0))
                image.putpixel((40 + col, 100 + row), (row, col, 200, 127))
                image.putpixel((64, 148), (row, col, 100, 255))
                image.save(self.root / "raw" / f"{pose}.png")
        self.save()

    def save(self, wrapped=False):
        self.jobs.write_text(json.dumps({"rows": self.rows} if wrapped else self.rows), encoding="utf-8")

    def test_exact_pixels_geometry_hashes_and_empty_tails(self):
        sheet, report = self.pack.build(self.jobs, (64, 148))
        self.assertEqual(sheet.size, (1188, 2952))
        self.assertEqual(report["packed_anchor"], [66, 150])
        self.assertEqual(report["counts"], list(COUNTS))
        self.assertEqual(len(report["frames"]), 108)
        self.assertEqual(report["jobs_sha256"], hashlib.sha256(self.jobs.read_bytes()).hexdigest())
        for row, count in enumerate(COUNTS):
            for col in range(9):
                x, y = col * 132, row * 164
                cell = sheet.crop((x, y, x + 132, y + 164))
                if col >= count:
                    self.assertEqual(cell.tobytes(), bytes(132 * 164 * 4))
                    continue
                source = self.root / "raw" / f"r{row:02}-c{col:02}.png"
                with Image.open(source) as image:
                    self.assertEqual(cell.crop((2, 2, 130, 162)).tobytes(), image.tobytes())
                for box in ((0, 0, 132, 2), (0, 162, 132, 164), (0, 0, 2, 164), (130, 0, 132, 164)):
                    self.assertFalse(any(cell.crop(box).tobytes()))
        record = report["frames"][0]
        self.assertEqual(record["sha256"], hashlib.sha256((self.root / record["source"]).read_bytes()).hexdigest())
        self.save(wrapped=True)
        _, other = self.pack.build(self.jobs, (62, 145))
        self.assertEqual(other["packed_anchor"], [64, 147])

    def test_invalid_mapping_fails_before_export(self):
        for mutation in (lambda: self.rows.pop(),
                         lambda: self.rows[0]["poses"].pop(),
                         lambda: self.rows[0]["poses"].__setitem__(0, "../escape"),
                         lambda: self.rows[0].update(row=True),
                         lambda: self.rows[0].update(job_id="")):
            original = json.loads(json.dumps(self.rows))
            mutation()
            self.save()
            with self.assertRaises(ValueError):
                self.pack.build(self.jobs, (64, 148))
            self.rows = original

    def test_missing_wrong_canvas_blank_opaque_and_duplicate_rejected(self):
        path = self.root / "raw/r00-c00.png"
        original = path.read_bytes()
        path.unlink()
        with self.assertRaises(OSError):
            self.pack.build(self.jobs, (64, 148))
        for image in (Image.new("RGBA", (60, 104)), Image.new("RGB", (128, 160)),
                      Image.new("RGBA", (128, 160)), Image.new("RGBA", (128, 160), "red")):
            image.save(path)
            with self.assertRaises(ValueError):
                self.pack.build(self.jobs, (64, 148))
        path.write_bytes((self.root / "raw/r00-c01.png").read_bytes())
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.pack.build(self.jobs, (64, 148))
        path.write_bytes(original)
        for anchor in ((-1, 148), (64, 161), (float("nan"), 0), (True, 0)):
            with self.assertRaises(ValueError):
                self.pack.build(self.jobs, anchor)

    def test_exports_are_reviewable_and_never_modify_inputs(self):
        before = {p: p.read_bytes() for p in self.root.rglob("*.png")}
        sheet, report = self.pack.build(self.jobs, (64, 148))
        with tempfile.TemporaryDirectory() as review:
            output = Path(review)
            self.pack.export(sheet, report, output)
            with Image.open(output / "candidate.png") as candidate:
                self.assertEqual(candidate.tobytes(), sheet.tobytes())
            with Image.open(output / "preview.gif") as gif:
                self.assertGreater(gif.n_frames, 1)
            self.assertTrue((output / "contact.png").is_file())
            self.assertEqual(json.loads((output / "report.json").read_text())["occupied"], 108)
        self.assertTrue(all(p.read_bytes() == data for p, data in before.items()))
        with self.assertRaises(ValueError):
            self.pack.export(sheet, report, self.root / "raw")

    def test_changed_inputs_prevent_export(self):
        sheet, report = self.pack.build(self.jobs, (64, 148))
        self.jobs.write_text("[]", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "jobs changed"):
            self.pack.verify_inputs(report)
        self.save()
        (self.root / "raw/r00-c00.png").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "input changed"):
            self.pack.verify_inputs(report)

    def test_public_promotion_requires_write_flag(self):
        with tempfile.TemporaryDirectory() as review:
            self.pack.OUTPUT = Path(review) / "review"
            self.pack.PUBLIC = Path(review) / "goku.png"
            self.pack.PUBLIC.write_bytes(b"existing public art")
            arguments = [str(SCRIPT), "--jobs", str(self.jobs), "--anchor", "64", "148"]
            with patch.object(sys, "argv", arguments):
                self.pack.main()
            self.assertEqual(self.pack.PUBLIC.read_bytes(), b"existing public art")
            with patch.object(sys, "argv", arguments + ["--write"]):
                self.pack.main()
            self.assertEqual(self.pack.PUBLIC.read_bytes(), (self.pack.OUTPUT / "candidate.png").read_bytes())

    def test_cli_requires_measured_anchor(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--jobs", str(self.jobs)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--anchor", result.stderr)

    def test_idle_hold_is_explicit_and_not_counted_as_new_drawing(self):
        source = self.root / "raw/r11-c00.png"
        (self.root / "raw/r11-c01.png").write_bytes(source.read_bytes())
        self.rows[11]["holds"] = {"r11-c01": "r11-c00"}
        self.save()
        _, report = self.pack.build(self.jobs, (64, 148))
        self.assertEqual(report["unique_poses"], 107)
        record = next(f for f in report["frames"] if f["pose"] == "r11-c01")
        self.assertEqual(record["hold_of"], "r11-c00")

    def test_false_hold_and_repeated_walk_are_rejected(self):
        self.rows[11]["holds"] = {"r11-c01": "r11-c00"}
        self.save()
        with self.assertRaisesRegex(ValueError, "declared hold"):
            self.pack.build(self.jobs, (64, 148))
        self.rows[11].pop("holds")
        (self.root / "raw/r03-c01.png").write_bytes((self.root / "raw/r03-c00.png").read_bytes())
        self.rows[3]["holds"] = {"r03-c01": "r03-c00"}
        self.save()
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.pack.build(self.jobs, (64, 148))


if __name__ == "__main__":
    unittest.main()
