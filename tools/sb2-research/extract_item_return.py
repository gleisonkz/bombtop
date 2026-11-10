"""Extrai fila e censo de posicoes apenas com cobertura REA explicita."""
import json
import struct
import sys
from pathlib import Path
from capture_json import iter_capture_records
from verify_effects import verify


def extract(bundle, journal, comparison, output, expected_cases=3):
    expected_cases = int(expected_cases)
    checked = json.loads(Path(comparison).read_text(encoding='utf-8'))
    if verify(bundle, journal, checked['evidence_id'], checked['script_id'],
              required_regions=(0x3a00, 0x3c00, 0x1e000)) != checked:
        raise ValueError('Comparacao diverge da evidencia preservada')
    cases = {}
    for record in iter_capture_records(journal):
        if record['name'] != 'read_ram' or record['label'] == 'entry-before':
            continue
        name, index = record['label'].rsplit('-', 1)
        ram = bytes.fromhex(json.loads(record['content'][0]['text'])['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        cases.setdefault(name, []).append({'index': int(index), 'phase': word(0x32),
            'seed': word(0xd6), 'history': [word(0x400 + i * 2) for i in range(16)],
            'queue': [word(0x3b48 + i * 2) for i in range(128)],
            'available': [word(0x1e000 + i * 2) for i in range(128)],
            'player': {'state': word(0x8000), 'flags60': word(0x8060),
                       'capacity': ram[0x80e1], 'fire': ram[0x80e2], 'speed': ram[0x80e0]},
            'grid': [[word(0x1c182 + y * 128 + x * 2) for x in range(15)] for y in range(13)]})
    if len(cases) != expected_cases or any([sample['index'] for sample in samples] != list(range(231)) for samples in cases.values()):
        raise ValueError(f'Cobertura{expected_cases}x230 ausente')
    with Path(output).open('x', encoding='utf-8') as stream:
        json.dump({'evidence_id': checked['evidence_id'], 'reads_matched': checked['sample_count'], 'cases': cases}, stream, indent=2)
        stream.write('\n')
    print({'cases': len(cases), 'reads_matched': checked['sample_count']})


if __name__ == '__main__':
    extract(*sys.argv[1:])
