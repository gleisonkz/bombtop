"""Extrai registros de efeito somente quando cobertos pelo observador REA."""
import json
import struct
import sys
from pathlib import Path
from capture_json import iter_capture_records
from verify_effects import verify


def extract(bundle, journal, comparison, output, expected_cases=5, expected_steps=160):
    expected_cases, expected_steps = int(expected_cases), int(expected_steps)
    checked = json.loads(Path(comparison).read_text(encoding='utf-8'))
    if verify(bundle, journal, checked['evidence_id'], checked['script_id'], required_regions=(0x10000,)) != checked:
        raise ValueError('Confronto diverge da comparacao preservada')
    cases = {}
    for record in iter_capture_records(journal):
        if record['name'] != 'read_ram' or record['label'] == 'entry-before':
            continue
        name, index = record['label'].rsplit('-', 1)
        response = json.loads(record['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        cases.setdefault(name, []).append({'index': int(index), 'phase': word(0x32),
            'center_code': word(0x1c182 + 6 * 128 + 7 * 2),
            'records': [{'slot': slot, 'background': word(0x10000 + slot * 16),
                         'cell': word(0x10002 + slot * 16),
                         'kind': ram[0x10004 + slot * 16], 'animation': ram[0x10005 + slot * 16],
                         'interval': ram[0x10006 + slot * 16], 'timer': ram[0x10007 + slot * 16],
                         'raw_hex': ram[0x10000 + slot * 16:0x10010 + slot * 16].hex()}
                        for slot in range(32)]})
    if len(cases) != expected_cases or any([sample['index'] for sample in samples] != list(range(expected_steps + 1)) for samples in cases.values()):
        raise ValueError('Cobertura esperada de ensaios ausente')
    with Path(output).open('x', encoding='utf-8') as stream:
        json.dump({'evidence_id': checked['evidence_id'], 'reads_matched': checked['sample_count'], 'cases': cases}, stream, indent=2)
        stream.write('\n')
    return {'cases': len(cases), 'reads_matched': checked['sample_count']}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
