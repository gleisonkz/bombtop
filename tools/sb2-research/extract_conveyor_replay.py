"""Reduz trajetórias completas já confrontadas com REA para o step real."""
import json
import struct
import sys
from pathlib import Path

rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
comparison = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
verified = {sample['label']: sample for sample in comparison['samples']}
cases = []
current = None
for row in rows:
    if row['name'] == 'load_state':
        current = {'label': row['label'], 'state_path': row.get('args', row.get('arguments', {}))['path'], 'events': []}
        cases.append(current)
    elif row['name'] == 'advance':
        current['events'].append({'kind': 'advance', **row.get('args', row.get('arguments', {}))})
    elif row['name'] == 'read_ram':
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        reference = verified[row['label']]
        if response['offset'] != 0 or len(ram) != 131072 or response['frame'] != reference['frame']:
            raise ValueError('Captura completa não corresponde à comparação')
        grid = [[struct.unpack_from('<H', ram, 0x1c182 + y * 128 + x * 2)[0] for x in range(15)] for y in range(13)]
        current['events'].append({'kind': 'sample', 'label': row['label'], 'frame': response['frame'],
                                  'rea_sample': reference['rea_sample'], 'players': reference['players'],
                                  'grid': grid, 'phase': struct.unpack_from('<H', ram, 0x32)[0],
                                  'seed': struct.unpack_from('<H', ram, 0xd6)[0], 'word': struct.unpack_from('<H', ram, 0x400)[0],
                                  'speed': struct.unpack_from('<H', ram, 0x80a0)[0] + struct.unpack_from('<H', ram, 0x80a2)[0] / 65536,
                                  'facing_code': struct.unpack_from('<H', ram, 0x805e)[0],
                                  'control_word': struct.unpack_from('<H', ram, 0x5cbe)[0]})
report = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
          'journal': sys.argv[1], 'comparison': sys.argv[2], 'cases': cases,
          'limitations': ['A interpretação dos bits de 0x5cbe é sustentada pelos ensaios separados de comando.',
                         'O script inicial observa posição/grade; o segundo também observa a região de controle pelo REA.']}
with Path(sys.argv[3]).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
print({'cases': len(cases), 'samples': sum(event['kind'] == 'sample' for case in cases for event in case['events'])})
