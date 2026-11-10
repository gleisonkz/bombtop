"""Extrai entidades móveis somente de estruturas já confrontadas com REA."""
import json
import struct
import sys
from pathlib import Path

journal, comparison_path, output = sys.argv[1:4]
comparison = json.loads(Path(comparison_path).read_text(encoding='utf-8'))
verified = {row['label']: row for row in comparison['samples']}
cases = []
for row in json.loads(Path(journal).read_text(encoding='utf-8')):
    if row['name'] == 'load_state':
        current = {'label': row['label'], 'samples': []}
        cases.append(current)
        buttons = []
        buttons2 = []
        last_positions = {}
    elif row['name'] == 'advance':
        args = row.get('arguments', row.get('args', {}))
        assert args['frames'] == 1
        buttons = args.get('buttons', [])
        buttons2 = args.get('buttons2', [])
    elif row['name'] == 'read_ram':
        response = json.loads(row['content'][0]['text'])
        reference = verified[row['label']]
        ram = bytes.fromhex(response['hex'])
        assert len(ram) == 131072 and response['offset'] == 0
        assert response['frame'] == reference['frame']
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        coordinate = lambda offset: word(offset) + word(offset + 2) / 65536
        moving = {word(base + 0x40): {'x': coordinate(base + 0x10), 'y': coordinate(base + 0x18)}
                  for base in range(0x8400, 0x8800, 0x100) if word(base) & 0xfc00 == 0x9400}
        first_bombs = []
        grid_bombs = [(x, y) for y in range(13) for x in range(15) if word(0x1c182 + y * 128 + x * 2) & 63 == 3]
        for seat in range(2):
            base = 0x12000 + seat * 0x100
            state = word(base) & 0xff00
            if state == 0x9000:
                position = moving[0x2000 + seat * 0x100]
                last_positions[seat] = position
                first_bombs.append({'seat': seat, 'moving': True, **position})
            elif state in (0x8000, 0xc000) and grid_bombs:
                prior = last_positions.get(seat, reference['players'][seat])
                distance = lambda at: ((at[0] + 1) * 16 - prior['x']) ** 2 + ((at[1] + 2) * 16 - prior['y']) ** 2
                choices = sorted(grid_bombs, key=distance)
                if distance(choices[0]) <= 256:
                    assert len(choices) == 1 or distance(choices[0]) < distance(choices[1]), 'Associação estática ambígua'
                    x, y = choices[0]
                    grid_bombs.remove((x, y))
                    first_bombs.append({'seat': seat, 'moving': False, 'grid_x': x, 'grid_y': y})
        current['samples'].append({
            'label': row['label'], 'frame': response['frame'], 'rea_sample': reference['rea_sample'],
            'buttons': buttons, 'buttons2': buttons2, 'phase': word(0x32), 'seed': word(0xd6), 'word': word(0x400),
            'players_full': [{**reference['players'][seat], 'speed': coordinate(0x80a0 + seat * 256),
                              'facing_code': word(0x805e + seat * 256)} for seat in range(4)],
            'first_bombs': first_bombs,
            'facing_code': word(0x805e), 'speed': coordinate(0x80a0),
            'grid': [[word(0x1c182 + y * 128 + x * 2) for x in range(15)] for y in range(13)],
            'item_bag': [word(0x3c48 + index * 2) for index in range(64)],
            'items': [{'x': x, 'y': y, 'glyph': word(0x1a0c2 + y * 64 + x * 2)}
                      for y in range(13) for x in range(15) if word(0x1c182 + y * 128 + x * 2) & 63 == 4],
            'control_word': word(0x5cbe), 'players': reference['players'],
            'bomb': {'state_word': word(0x8400), 'x': coordinate(0x8410), 'y': coordinate(0x8418),
                     'table_state': word(0x12000), 'table_timer': word(0x12004)},
        })
report = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
          'journal': journal, 'comparison': comparison_path, 'cases': cases,
          'limitations': ['Quatro slots móveis 0x8400..0x8700; primeira entrada de bomba de P1/P2 apenas.',
                          'Bomba estática associada à célula marcada mais próxima da última posição observada; rejeita empate.',
                          'Estado zero invalida a posição antiga; não equivale ao frame de explosão.']}
with Path(output).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
print({'cases': len(cases), 'samples': sum(len(case['samples']) for case in cases)})
