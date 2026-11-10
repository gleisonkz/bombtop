"""Extrai posições e velocidades do gelo após confronto completo REA/MCP."""
import json
import struct
import sys
from pathlib import Path
from verify_effects import verify


def extract(bundle, journal, comparison_path, output_path):
    comparison = json.loads(Path(comparison_path).read_text())
    if verify(bundle, journal, comparison['evidence_id'], comparison['script_id']) != comparison:
        raise ValueError('Comparação não corresponde aos arquivos')
    cases, buttons = {}, []
    for row in json.loads(Path(journal).read_text()):
        if row['name'] == 'advance':
            buttons = row['arguments'].get('buttons', [])
        if row['name'] != 'read_ram' or row['label'] == 'ice-start':
            continue
        name, index = row['label'].rsplit('-', 1)
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        value = lambda offset: word(offset) + word(offset + 2) / 65536
        flags = word(0x8000)
        cases.setdefault(name, []).append({'index': int(index), 'frame': response['frame'],
            'buttons': buttons if int(index) else [],
            'player': {'x': value(0x8010), 'y': value(0x8018),
                       'vx': value(0x8014) * (-1 if flags & 1 else 1) or 0,
                       'vy': value(0x801c) * (-1 if flags & 2 else 1) or 0, 'flags': flags},
            'grid': [[word(0x1c182 + y * 128 + x * 2) for x in range(15)] for y in range(13)]})
    if len(cases) != 4 or any([sample['index'] for sample in samples] != list(range(97)) for samples in cases.values()):
        raise ValueError('Cobertura incompleta')
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
        'native_reads_matched': comparison['sample_count'], 'cases': cases,
        'limitations': ['Modelo cinemático ainda separado das colisões e demais pisos.',
            'Velocidade base, dois humanos; não certifica inventários nem toda a arena.']}
    with Path(output_path).open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
    return {'cases': len(cases), 'native_steps': 384}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
