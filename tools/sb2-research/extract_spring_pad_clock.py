"""Extrai somente o primeiro registro3D88,coberto pela regiao REA3C00..3DFF."""
import json
import struct
import sys
from pathlib import Path
from capture_json import iter_capture_records
from verify_effects import verify


def extract(bundle, journal, comparison, output):
    checked = json.loads(Path(comparison).read_text(encoding='utf-8'))
    if verify(bundle, journal, checked['evidence_id'], checked['script_id'], required_regions=(0x3c00,)) != checked:
        raise ValueError('Comparacao difere da evidencia preservada')
    cases = {}
    for record in iter_capture_records(journal):
        if record['name'] != 'read_ram':
            continue
        name, index = record['label'].rsplit('-', 1)
        ram = bytes.fromhex(json.loads(record['content'][0]['text'])['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        cases.setdefault(name, []).append({'index': int(index), 'phase': word(0x32),
            'active': word(0x3d88) < 0x8000, 'timer': word(0x3d8e), 'command': word(0x3d90),
            'cell': word(0x3d8c), 'path': int.from_bytes(ram[0x3d92:0x3d95], 'little'),
            'pad_code': word(0x1c182 + 4 * 128 + 7 * 2), 'raw_hex': ram[0x3d88:0x3d98].hex()})
    if len(cases) != 4 or any([s['index'] for s in samples] != list(range(201)) for samples in cases.values()):
        raise ValueError('Cobertura4x200 ausente')
    with Path(output).open('x', encoding='utf-8') as stream:
        json.dump({'evidence_id': checked['evidence_id'], 'reads_matched': checked['sample_count'],
                   'cases': cases}, stream, indent=2)
        stream.write('\n')
    print({'cases': len(cases), 'reads_matched': checked['sample_count']})


if __name__ == '__main__':
    extract(*sys.argv[1:])
