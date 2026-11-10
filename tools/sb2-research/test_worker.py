"""Verifica leitura limitada e reprodução de estados com o núcleo real."""
import os
import struct
import tempfile
import unittest
from pathlib import Path
from snes9x_worker import Emulator


class WorkerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.emulator = Emulator(os.environ['SNES9X_CORE'])
        cls.emulator.run('load_rom', {'path': os.environ['SB2_ROM']})

    @classmethod
    def tearDownClass(cls):
        cls.emulator.dll.retro_unload_game()
        cls.emulator.dll.retro_deinit()

    def test_state_replay_matches_ram_and_pixels(self):
        e = self.emulator
        e.run('advance', {'frames': 740})
        with tempfile.TemporaryDirectory() as folder:
            state = str(Path(folder) / 'state.bin')
            e.run('save_state', {'path': state})
            e.run('advance', {'frames': 60, 'buttons': ['DOWN']})
            ram = e.run('read_ram', {})['hex']
            screen = e.run('get_screen', {})['png']
            e.run('load_state', {'path': state})
            e.run('advance', {'frames': 60, 'buttons': ['DOWN']})
            self.assertEqual(ram, e.run('read_ram', {})['hex'])
            self.assertEqual(screen, e.run('get_screen', {})['png'])

    def test_invalid_reads_do_not_access_native_memory(self):
        for args in ({'offset': -1}, {'offset': 131072, 'length': 1}, {'length': 0}):
            with self.assertRaises(ValueError):
                self.emulator.run('read_ram', args)

    def test_frame_limits(self):
        for frames in (0, -1, 36001, 0.5):
            with self.assertRaises(ValueError):
                self.emulator.run('advance', {'frames': frames})

    def test_native_timing_matches_pal_clock(self):
        timing = self.emulator.status()['native_timing']
        self.assertEqual('PAL', timing['region'])
        self.assertAlmostEqual(21281370 / 425568, timing['frames_per_second'], places=12)
        self.assertGreater(timing['audio_sample_rate'], 0)

    def test_second_controller_moves_only_second_player_and_releases(self):
        e = self.emulator
        state = Path(__file__).resolve().parents[2] / 'output/sb2-research/bomb-timing/initial.state'
        e.run('load_state', {'path': str(state)})
        before = bytes.fromhex(e.run('read_ram', {})['hex'])
        e.run('advance', {'frames': 13, 'buttons2': ['LEFT']})
        after = bytes.fromhex(e.run('read_ram', {})['hex'])
        self.assertEqual(before[0x8010:0x801c], after[0x8010:0x801c])
        self.assertEqual(struct.unpack_from('<H', before, 0x8110)[0] - 17,
                         struct.unpack_from('<H', after, 0x8110)[0])
        self.assertEqual(0xc000, struct.unpack_from('<H', after, 0x8112)[0])
        e.run('advance', {'frames': 2})
        released = bytes.fromhex(e.run('read_ram', {})['hex'])
        self.assertEqual(after[0x8110:0x8114], released[0x8110:0x8114])
        self.assertEqual(after[0x8118:0x811c], released[0x8118:0x811c])
        e.run('load_state', {'path': str(state)})
        e.run('advance', {'frames': 13, 'buttons2': ['LEFT']})
        self.assertEqual(after, bytes.fromhex(e.run('read_ram', {})['hex']))

    def test_save_cannot_overwrite_existing_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            state = str(Path(folder) / 'state.bin')
            self.emulator.run('save_state', {'path': state})
            with self.assertRaises(FileExistsError):
                self.emulator.run('save_state', {'path': state})


if __name__ == '__main__':
    unittest.main()
