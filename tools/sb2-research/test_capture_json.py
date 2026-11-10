"""Confere fronteiras de blocos e rejeicao de capturas incompletas."""
import json
import tempfile
import unittest
from pathlib import Path
from capture_json import iter_capture_records


class CaptureJsonTests(unittest.TestCase):
    def read(self, text, chunk):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'journal.json'
            path.write_text(text, encoding='utf-8')
            return list(iter_capture_records(path, chunk))

    def test_records_cross_chunk_boundaries(self):
        records = [{'content': [{'text': 'ação \\" ] , } ' * 50}], 'frames': 180}, {}, {'nested': [1, False, None]}]
        text = json.dumps(records, ensure_ascii=False)
        for chunk in (1, 7, 64, 65536):
            self.assertEqual(self.read(text, chunk), records)
        self.assertEqual(self.read(' [ ] \n', 1), [])

    def test_rejects_incomplete_or_malformed_journals(self):
        for text in ('', '[', '[{}', '[{},', '[{},]', '[{} {}]', '[{}] {}', '[{"x":"unfinished', '{}', '[12]'):
            with self.subTest(text=text), self.assertRaises(ValueError):
                self.read(text, 1)


if __name__ == '__main__':
    unittest.main()
