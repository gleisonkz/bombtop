"""Senha 5656 (1C68=FFFF): confere REA x MCP e extrai registradores do fechamento a cada leitura.

Uso: python extract_closure_extended.py pasta-da-captura saida.json
A pasta tem rea-bundle.json (rea-closure-extended.js) e cap/c%04d.bin (WRAM inteira, 3 quadros entre leituras,
a primeira 3 quadros depois de pre-closure.state, quadro 9300 do worker).
"""
import json
import struct
import sys
from pathlib import Path

FIRST_FRAME, STEP = 9303, 3


def word(ram, at):
    return struct.unpack_from('<H', ram, at)[0]


def check_rea(folder, reads):
    bundle = json.loads((folder / 'rea-bundle.json').read_text(encoding='utf-8'))
    samples, checked = [], 0
    for record in bundle['records']:
        result = record.get('normalized_result')
        if not isinstance(result, dict):
            continue
        for message in result.get('messages', []):
            if message.get('type') == 'send' and message['payload'].get('kind') == 'arena-effects':
                samples.append((record['evidence_id'], message['script_id'], message['payload']))
    for _, _, payload in samples:
        ram = reads[payload['sample'] - 1]
        for name, offset in (('current', 0x1c182), ('background', 0x1d182)):
            for y in range(13):
                for x in range(15):
                    checked += 1
                    if word(ram, offset + y * 128 + x * 2) != payload['grids'][name][y][x]:
                        raise SystemExit(f'grade {name} diverge na amostra {payload["sample"]}')
        for player in payload['players']:
            checked += 1
            if ram[0x8000 + player['seat'] * 256:][:256].hex() != player['raw_hex']:
                raise SystemExit(f'jogador diverge na amostra {payload["sample"]}')
        for region in payload['candidate_regions']:
            checked += 1
            if ram[region['offset']:][:len(region['raw_hex']) // 2].hex() != region['raw_hex']:
                raise SystemExit(f'região {hex(region["offset"])} diverge na amostra {payload["sample"]}')
    return {'evidence_id': samples[0][0], 'script_id': samples[0][1], 'samples': len(samples),
            'first_sample': samples[0][2]['sample'], 'last_sample': samples[-1][2]['sample'], 'comparisons': checked}


def main(folder, output):
    folder = Path(folder)
    reads = [p.read_bytes() for p in sorted((folder / 'cap').glob('c*.bin'))]
    rea = check_rea(folder, reads)
    rows, walls, previous = [], [], None
    for i, ram in enumerate(reads):
        grid = [[ram[0x1c182 + y * 128 + x * 2] for x in range(15)] for y in range(13)]
        if previous:
            walls += [{'read': i, 'cell': (y - 1) * 13 + x - 1} for y in range(13) for x in range(15)
                      if grid[y][x] == 0xC1 and previous[y][x] != 0xC1]
        previous = grid
        rows.append({'read': i, 'frame': FIRST_FRAME + STEP * i,
                     'clock': [word(ram, 0x5e10), word(ram, 0x5e12), word(ram, 0x5e14)],
                     'closure': [word(ram, 0x5d0e + 2 * k) for k in range(5)],
                     'extended': word(ram, 0x1c68),
                     'players': [{'x': word(ram, 0x8010 + s * 256), 'y': word(ram, 0x8018 + s * 256),
                                  'alive': word(ram, 0x8000 + s * 256) < 0x9800} for s in range(2)]})
    report = {'rom': 'Super Bomberman 2 (USA), sha256 0a4b4a783a7faf6ada3e1326ecf85de77e8c2a171659b42a78a1fae43f806ca6;'
                     ' C0D5BB/C0D83E/C11C1C e tabela C5E1C9 iguais byte a byte aos da versão europeia',
              'core': 'Snes9x 1.63 fae2fea, sha256 9573c48f4d87f72d6208609bb08fd762e30978eb111094b073f86fc9afe54592',
              'setup': 'senha 5656 (CC1926: entrada 10 da tabela CC0000 -> 1C6A=0A -> CC1869 grava 1C68=FFFF); '
                       'Battle, single, P1/P2 MAN, P3/P4 OFF, 2:00, G-Bomber OFF, arena 1; P1 em (4,5), P2 em (10,7)',
              'step_frames': STEP, 'rea': rea, 'walls': walls, 'reads': rows}
    Path(output).write_text(json.dumps(report, separators=(',', ':')) + '\n', encoding='utf-8')
    print(rea, 'walls', len(walls))


if __name__ == '__main__':
    main(*sys.argv[1:])
