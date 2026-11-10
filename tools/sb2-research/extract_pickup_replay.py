"""Reduz o journal já confrontado com REA para reexecutar comandos no step."""
import json
import struct
import sys
from pathlib import Path

rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
comparison = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
verified = {row['label']: row for row in comparison['samples']}
events = []
for row in rows:
    if row['name'] == 'advance':
        events.append({'kind': 'advance', **row['arguments']})
    elif row['name'] == 'read_ram':
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        sample = verified[row['label']]
        if response['frame'] != sample['frame']:
            raise ValueError('Frame divergente da comparação REA/MCP')
        grid = [[struct.unpack_from('<H', ram, 0x1c182 + y * 128 + x * 2)[0]
                 for x in range(15)] for y in range(13)]
        items = [{'x': x, 'y': y, 'glyph': struct.unpack_from('<H', ram, 0x1a0c2 + y * 64 + x * 2)[0]}
                 for y in range(13) for x in range(15) if grid[y][x] & 63 == 4]
        events.append({'kind': 'sample', 'label': row['label'], 'frame': response['frame'],
                       'phase': struct.unpack_from('<H', ram, 0x32)[0], 'grid': grid,
                       'players': sample['players'], 'inventory': list(ram[0x80e0:0x8100]),
                       'speed': struct.unpack_from('<H', ram, 0x80a0)[0] + struct.unpack_from('<H', ram, 0x80a2)[0] / 65536,
                       'seed': struct.unpack_from('<H', ram, 0xd6)[0], 'word': struct.unpack_from('<H', ram, 0x400)[0],
                       'bag': list(struct.unpack_from('<64H', ram, 0x3c48)), 'items': items})
        if row['label'] == sys.argv[3]:
            break
else:
    raise ValueError('Ponto final não encontrado')
report = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
          'journal': sys.argv[1], 'comparison': sys.argv[2], 'events': events}
with Path(sys.argv[4]).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
print({'events': len(events), 'samples': sum(event['kind'] == 'sample' for event in events)})
