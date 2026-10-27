"""Synthetic source fixtures; never require generated art or mutate real inputs."""
import copy
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image, ImageDraw


SCRIPT = Path(__file__).with_name('pack-static-approved.py')


def load_packer():
    spec = importlib.util.spec_from_file_location('static_approved', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class StaticApprovedTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.exists(), 'Static approved packer has not been implemented')
        self.p = load_packer()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.contract = json.loads((self.p.SOURCE_DIR / 'contract.json').read_text())

    def fixture(self):
        for family in self.contract['families']:
            image = Image.new('RGBA', (1800, 300 * len(family['rows'])), (210, 23, 41, 0))
            draw = ImageDraw.Draw(image)
            for band, row in enumerate(family['rows']):
                for col in range(row['count']):
                    x, y = 20 + col * 155, band * 300 + 80
                    # First standing pose is exactly 148px; later raised arms add
                    # 40px without changing body proportions or feet position.
                    top = y - (40 if col else 0)
                    draw.rectangle((x, top, x + 39, y + 147), fill=(57 + col, 61, 69, 128))
                    draw.rectangle((x + 5, y + 15, x + 20, y + 50), fill=(17, 30, 219, 255))
                    if row['row'] == 17:
                        draw.rectangle((x, y + 110, x + 39, y + 147), fill=(140, 140, 140, 255))
            image.save(self.directory / (family['name'] + '.generated.png'))
        (self.directory / 'contract.json').write_text(json.dumps(self.contract))

    def test_canonical_counts_fixed_scale_alpha_and_source_preservation(self):
        self.fixture()
        before = {p.name: p.read_bytes() for p in self.directory.glob('*.generated.png')}
        atlas, report = self.p.build_sheet(self.directory, self.contract)
        self.assertEqual(atlas.size, (2352, 4256))
        self.assertEqual(report['frame_count'], 107)
        for family in self.contract['families']:
            frames = [f for f in report['frames'] if f['family'] == family['name']]
            self.assertEqual({f['scale'] for f in frames}, {1.0})
            self.assertEqual(frames[0]['target_box'][3], frames[1]['target_box'][3])
            self.assertEqual(frames[1]['target_box'][3] - frames[1]['target_box'][1], 188)
        pixels = np.array(atlas)
        self.assertEqual(set(np.unique(pixels[:, :, 3])), {0, 255})
        self.assertFalse(pixels[pixels[:, :, 3] == 0].any())
        for frame in report['frames']:
            x, y = frame['column'] * 168, frame['row'] * 224
            cell = atlas.crop((x, y, x + 168, y + 224))
            source = Image.open(self.directory / (frame['family'] + '.generated.png')).crop(frame['source_box'])
            expected = np.array(source)
            expected[expected[:, :, 3] < 128] = 0
            expected[expected[:, :, 3] >= 128, 3] = 255
            self.assertTrue(np.array_equal(np.array(cell.crop(cell.getbbox())), expected))
        for row, count in enumerate(self.p.COUNTS):
            self.assertIsNone(atlas.crop((count * 168, row * 224, 2352, (row + 1) * 224)).getbbox())
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.directory.glob('*.generated.png')})
        other, second_report = self.p.build_sheet(self.directory, self.contract)
        self.assertEqual(self.p.png_bytes(atlas), self.p.png_bytes(other))
        self.assertEqual(report, second_report)
        self.assertEqual(len(report['paint_regions']['rows']), 19)

    def test_count_and_source_edge_rejected(self):
        self.fixture()
        path = self.directory / 'idle.generated.png'
        with Image.open(path) as source:
            image = source.copy()
        ImageDraw.Draw(image).rectangle((1700, 80, 1740, 220), fill=(2, 3, 4, 255))
        image.save(path)
        with self.assertRaisesRegex(self.p.PackingError, 'count'):
            self.p.build_sheet(self.directory, self.contract)
        self.fixture()
        with Image.open(path) as source:
            image = source.copy()
        ImageDraw.Draw(image).rectangle((0, 80, 30, 220), fill=(2, 3, 4, 255))
        image.save(path)
        with self.assertRaisesRegex(self.p.PackingError, 'source clipping'):
            self.p.build_sheet(self.directory, self.contract)

    def test_family_overflow_requires_geometry_never_shrink(self):
        image = Image.new('RGBA', (40, 148), (20, 30, 40, 255))
        wide = Image.new('RGBA', (167, 90), (20, 30, 40, 255))
        tall = Image.new('RGBA', (40, 209), (20, 30, 40, 255))
        first = (image, {'family': 'reaction', 'row': 6, 'column': 0, 'source_box': [1, 1, 41, 149]})
        for pose in (wide, tall):
            next_frame = (pose, {'family': 'reaction', 'row': 7, 'column': 0, 'source_box': [1, 1, pose.width + 1, pose.height + 1]})
            with self.assertRaisesRegex(self.p.PackingError, 'geometry'):
                self.p.register_family([[first], [next_frame]], {'name': 'reaction'})

    def test_nonunit_family_scale_and_explicit_standing_measurement(self):
        standing = Image.new('RGBA', (20, 74), (11, 51, 211, 255))
        raised = Image.new('RGBA', (20, 94), (11, 51, 211, 255))
        rows = [[(pose, {'family': 'victory', 'row': 18, 'column': col,
                         'source_box': [1, 1, pose.width + 1, pose.height + 1]})
                 for col, pose in enumerate((standing, raised))]]
        frames, scale = self.p.register_family(rows, {'name': 'victory'})
        self.assertEqual(scale, 2)
        self.assertEqual([cell.getbbox()[3] - cell.getbbox()[1] for cell, _ in frames], [148, 188])
        for cell, record in frames:
            source = (standing, raised)[record['column']]
            expected = source.resize((40, source.height * 2), Image.Resampling.NEAREST)
            self.assertEqual(cell.crop(cell.getbbox()).tobytes(), expected.tobytes())
        frames, scale = self.p.register_family([rows[0][1:]], {'name': 'victory'}, standing_height=74)
        self.assertEqual(scale, 2)
        self.assertEqual(frames[0][0].getbbox()[3] - frames[0][0].getbbox()[1], 188)
        for invalid in (0, -1, float('nan'), float('inf'), True):
            with self.assertRaises(self.p.PackingError):
                self.p.register_family(rows, {'name': 'victory'}, standing_height=invalid)

    def test_detached_prop_review_and_threshold_boundary(self):
        image = Image.new('RGBA', (100, 100), (199, 22, 12, 127))
        draw = ImageDraw.Draw(image)
        draw.rectangle((20, 10, 39, 59), fill=(11, 22, 33, 128))
        draw.rectangle((15, 70, 45, 79), fill=(140, 140, 140, 255))
        family = {'name': 'menu', 'rows': [{'row': 17, 'count': 1}]}
        with self.assertRaisesRegex(self.p.PackingError, 'count'):
            self.p.extract_family(image, family)
        rows = self.p.extract_family(image, family, overrides={'source_boxes': {'17': [[10, 5, 50, 85]]}})
        pose = rows[0][0][0]
        self.assertEqual(pose.size, (31, 70))
        pixels = np.array(pose)
        self.assertEqual(set(np.unique(pixels[:, :, 3])), {0, 255})
        self.assertFalse(pixels[pixels[:, :, 3] == 0].any())
        self.assertEqual(int((pixels[:, :, 3] == 255).sum()), 20 * 50 + 31 * 10)

    def test_victory_jump_lifts_only_column_six_after_foot_registration(self):
        pose = Image.new('RGBA', (40, 148), (11, 51, 211, 255))
        rows = [[(pose, {'family': 'victory', 'row': 18, 'column': col,
                         'source_box': [1, 1, 41, 149]}) for col in range(11)]]
        frames, scale = self.p.register_family(rows, {'name': 'victory'})
        self.assertEqual(scale, 1)
        for cell, record in frames:
            lift = 12 if record['column'] == 6 else 0
            self.assertEqual(record['jump_lift'], lift)
            self.assertEqual(record['target_anchor'], [82, 208])
            self.assertEqual(record['registered_anchor'], [82, 208 - lift])
            self.assertEqual(cell.getbbox()[3], 208 - lift)
            self.assertEqual(cell.crop(cell.getbbox()).tobytes(), pose.tobytes())
        # Native lift stays 12px even when source art is scaled by two.
        small = pose.resize((20, 74), Image.Resampling.NEAREST)
        rows = [[(small, {'family': 'victory', 'row': 18, 'column': 6,
                          'source_box': [1, 1, 21, 75]})]]
        frames, scale = self.p.register_family(rows, {'name': 'victory'})
        self.assertEqual(scale, 2)
        self.assertEqual(frames[0][1]['registered_anchor'][1], 196)

    def test_jump_lift_is_included_in_clipping_check(self):
        standing = Image.new('RGBA', (40, 148), (11, 51, 211, 255))
        raised = Image.new('RGBA', (40, 200), (11, 51, 211, 255))
        rows = [[(pose, {'family': 'victory', 'row': 18, 'column': col,
                         'source_box': [1, 1, 41, pose.height + 1]})
                 for col, pose in ((0, standing), (6, raised))]]
        with self.assertRaisesRegex(self.p.PackingError, 'geometry'):
            self.p.register_family(rows, {'name': 'victory'})

    def test_cli_refuses_public_and_source_overwrite(self):
        self.fixture()
        for output in (self.directory / 'idle.generated.png',
                       self.directory / 'approved-reference.png',
                       self.p.ROOT / 'apps/client/public/sprites/static-final.png'):
            if output.name == 'approved-reference.png':
                output.write_bytes(b'untouched reference fixture')
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as caught:
                self.p.main(['--source-dir', str(self.directory), '--output', str(output)])
            self.assertEqual(caught.exception.code, 2)
        self.assertEqual((self.directory / 'approved-reference.png').read_bytes(), b'untouched reference fixture')

    def test_contract_missing_inputs_and_hash_lock(self):
        bad = copy.deepcopy(self.contract)
        bad['families'][-1]['rows'][0]['count'] = 10
        with self.assertRaises(self.p.PackingError):
            self.p.build_sheet(self.directory, bad)
        with self.assertRaisesRegex(self.p.PackingError, 'Missing'):
            self.p.build_sheet(self.directory, self.contract)
        self.fixture()
        with self.assertRaisesRegex(self.p.PackingError, 'sha256'):
            self.p.build_sheet(self.directory, self.contract, manifest={'idle': {'sha256': 'wrong'}})

    def test_cli_candidate_and_failed_report(self):
        self.fixture()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(self.p.main(['--source-dir', str(self.directory), '--contact', '--gif']), 0)
        self.assertTrue((self.directory / 'static-candidate.png').is_file())
        self.assertTrue((self.directory / 'static-contact.png').is_file())
        with Image.open(self.directory / 'static-preview.gif') as preview:
            self.assertEqual(preview.n_frames, 11)
        report = json.loads((self.directory / 'report.json').read_text())
        self.assertEqual(report['frame_count'], 107)
        protection_path = self.directory / 'static-paint-regions.json'
        self.assertTrue(protection_path.is_file(), 'Candidate protection JSON must be exported separately')
        self.assertEqual(json.loads(protection_path.read_text()), report['paint_regions'])
        (self.directory / 'idle.generated.png').unlink()
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            self.p.main(['--source-dir', str(self.directory)])
        report = json.loads((self.directory / 'report.json').read_text())
        self.assertEqual(report['status'], 'failed')

    def test_physical_two_band_boards_use_manifest_playback_order(self):
        self.fixture()
        manifest = {}
        for name, row, count, top_count in (('menu', 17, 10, 5), ('victory', 18, 11, 6)):
            image = Image.new('RGBA', (1000, 600))
            draw = ImageDraw.Draw(image)
            boxes = []
            for index in range(count):
                band, col = divmod(index, top_count)
                x, y = 20 + col * 155, 80 + band * 300
                draw.rectangle((x, y, x + 39, y + 147), fill=(40 + index, 61, 69, 255))
                if name == 'menu':
                    draw.rectangle((x, y + 110, x + 39, y + 147), fill=(140, 140, 140, 255))
                boxes.append([x, y, x + 40, y + 148])
            image.save(self.directory / f'{name}.generated.png')
            manifest[name] = {'source_boxes': {str(row): boxes}}
        (self.directory / 'measurements.json').write_text(json.dumps(manifest))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(self.p.main(['--source-dir', str(self.directory)]), 0)
        report = json.loads((self.directory / 'report.json').read_text())
        for name, row, count in (('menu', 17, 10), ('victory', 18, 11)):
            frames = [f for f in report['frames'] if f['family'] == name]
            self.assertEqual([f['row'] for f in frames], [row] * count)
            self.assertEqual([f['source_box'] for f in frames], manifest[name]['source_boxes'][str(row)])
            self.assertEqual([f['column'] for f in frames], list(range(count)))

    def test_explicit_manifest_takes_precedence_over_auto_measurements(self):
        self.fixture()
        (self.directory / 'measurements.json').write_text(json.dumps({'idle': {'sha256': 'wrong'}}))
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            self.p.main(['--source-dir', str(self.directory)])
        explicit = self.directory / 'explicit.json'
        explicit.write_text('{}')
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(self.p.main(['--source-dir', str(self.directory), '--manifest', str(explicit)]), 0)


if __name__ == '__main__':
    unittest.main()
