"""Emite replays de bombas junto aos portais após confronto REA/MCP."""
import json
import struct
import sys
from pathlib import Path
from verify_effects import verify
from capture_json import iter_capture_records


def extract(bundle_path, journal_path, comparison_path, output_path, expected_cases=6, expected_steps=70):
    expected_cases, expected_steps = int(expected_cases), int(expected_steps)
    comparison = json.loads(Path(comparison_path).read_text())
    checked = verify(bundle_path, journal_path, comparison['evidence_id'], comparison['script_id'])
    if checked != comparison:
        raise ValueError('Comparação não corresponde à evidência atual')
    journal = iter_capture_records(journal_path)
    cases = {}
    commands = {}
    for record in journal:
        if record['name'] == 'advance':
            commands = record['arguments']
        if record['name'] != 'read_ram' or record['label'] == 'entry-before':
            continue
        name, index = record['label'].rsplit('-', 1)
        response = json.loads(record['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        def word(offset):
            return struct.unpack_from('<H', ram, offset)[0]
        players = []
        for seat in range(2):
            base = 0x8000 + seat * 256
            players.append({'x': word(base + 0x10) + word(base + 0x12) / 65536,
                            'y': word(base + 0x18) + word(base + 0x1a) / 65536,
                            'vx': (word(base + 0x14) + word(base + 0x16) / 65536) * (-1 if word(base) & 1 else 1) or 0,
                            'vy': (word(base + 0x1c) + word(base + 0x1e) / 65536) * (-1 if word(base) & 2 else 1) or 0,
                            'state_word': word(base),
                            'mode_word': word(base + 2), 'latches': word(base + 0x52), 'facing': word(base + 0x5e),
                            'jump_target_y': ram[base + 0xc0], 'jump_direction': word(base + 0xc2),
                            'inventory': {'speed': ram[base + 0xe0], 'capacity': ram[base + 0xe1], 'fire': ram[base + 0xe2],
                                          'glove': ram[base + 0xfe], 'kick': ram[base + 0xff]}})
        grid_bombs = {(x, y) for y in range(13) for x in range(15)
                      if word(0x1c182 + y * 128 + x * 2) & 63 == 3}
        bombs = []
        # O observador REA preserva 2.048 bytes: oito entradas, com autor próprio.
        for slot in range(8):
            base = 0x12000 + slot * 256
            if word(base) & 0xff00 not in (0x8000, 0xc000):
                continue
            position = word(base + 0x0a)
            x, y = (position % 128) // 2 - 1, position // 128 - 3
            if (x, y) in grid_bombs:
                owner = ram[base + 6]
                if owner not in (0, 1):
                    raise ValueError('Autor fora do ensaio de dois humanos')
                bombs.append({'x': x, 'y': y, 'owner': owner, 'range': ram[base + 7] + 1})
        if {(bomb['x'], bomb['y']) for bomb in bombs} != grid_bombs or len(bombs) != len(grid_bombs):
            raise ValueError(f"Associação de bombas estáticas incompleta: {record['label']}")
        # Os quatro slots móveis são cobertos pelo mesmo observador REA.
        # Preservar campos brutos: a interpretação do fusível continua separada.
        mobile_bombs = []
        jump_proxies = []
        airborne_items = []
        thrown_bombs = []
        candidate_entities = []
        for slot in range(4):
            base = 0x8400 + slot * 256
            if not word(base):
                continue
            entity = {'slot': slot, 'state': word(base),
                                 'x': word(base + 0x10) + word(base + 0x12) / 65536,
                                 'y': word(base + 0x18) + word(base + 0x1a) / 65536,
                                 'cell_word': word(base + 0xa8), 'entry_latch': word(base + 0xc0),
                                 'cell_delta': struct.unpack_from('<h', ram, base + 0x46)[0],
                                 'raw_hex': ram[base:base + 256].hex()}
            candidate_entities.append(entity)
            static_link = word(base + 0x40)
            jump_owners = [seat for seat in range(2)
                           if word(0x8000 + seat * 256 + 0xc8) == base
                           and (word(0x8000 + seat * 256 + 2) & 1
                                or word(0x8000 + seat * 256 + 0x52) & 0x1000)]
            # O salto aloca os mesmos slots: +C8 do jogador aponta ao auxiliar,
            # cujo +40 é zero. Bombas móveis apontam à tabela estática em 7F.
            proxy_state = word(base) & 0xfe
            # O auxiliar do lancamento DOWN12 inicia descendente (08),
            # mantendo C8 e o tipo0400 observado nos outros saltos12.
            descending_spring = proxy_state == 0x08 and word(base + 0x7e) == 0x400 \
                and any(word(0x8000 + seat * 256 + 0x52) & 0x1000 for seat in jump_owners)
            if not static_link and len(jump_owners) == 1 and (proxy_state == 0x0a or descending_spring):
                jump_proxies.append({**entity, 'owner': jump_owners[0]})
            elif word(base + 0x7e) == 0x200 and word(base + 6) in (0x8000, 0x8100) \
                    and word(base + 0x4a) in (0x1600, 0x1602, 0x1606, 0x160a, 0x1622, 0x1624, 0x1626, 0x1628, 0x162a):
                # C093F6 percorre uma trajetoria apontada por+43; +4A guarda
                # o glifo do item e+06 o jogador de origem, nao o autor de bomba.
                # Slots reciclados podem manter+40 de uma bomba anterior;
                # tipo0200/glifo/autor definem o item,nao o vinculo residual.
                airborne_items.append({**entity, 'owner': (word(base + 6) - 0x8000) // 256,
                                       'glyph': word(base + 0x4a)})
            elif 0x2000 <= static_link <= 0x2700 and static_link % 256 == 0:
                if word(0x10000 + static_link) & 0xff00 == 0x9000:
                    thrown_bombs.append(entity)
                else:
                    mobile_bombs.append(entity)
            else:
                raise ValueError(f"Entidade auxiliar não classificada: {record['label']} {base:04x}")
        sample = {'index': int(index), 'frame': response['frame'], 'players': players, 'bombs': bombs,
                  'battle_clock': {'minutes': word(0x5e10), 'seconds': word(0x5e12), 'frame': word(0x5e14)},
                  'closure': {'flags': word(0x5d0e), 'timer': word(0x5d10), 'index': word(0x5d12),
                              'animation': word(0x5d14), 'cell': word(0x5d16), 'extended': bool(word(0x1c68))},
                  'mobile_bombs': mobile_bombs,
                  'thrown_bombs': thrown_bombs,
                  'jump_proxies': jump_proxies, 'candidate_entities': candidate_entities,
                  'airborne_items': airborne_items,
                  'player_reservations': [word(0x2720), word(0x2722)],
                  'static_bomb_records': [{'slot': slot, 'raw_hex': ram[0x12000 + slot * 256:0x12100 + slot * 256].hex()}
                                          for slot in range(8) if word(0x12000 + slot * 256)],
                  'channel_clock': {'index': struct.unpack_from('<h', ram, 0x5ce2)[0], 'timer': word(0x5ce4)},
                  'grid': [[word(0x1c182 + y * 128 + x * 2) for x in range(15)] for y in range(13)],
                  'phase': word(0x32), 'seed': word(0xd6), 'word': word(0x400),
                  'random_history': [word(i) for i in range(0x400, 0x420, 2)],
                  'transport_phase': word(0x5d0e),
                  'tunnel_gate_word': word(0x5d04), 'tunnel_gate_owners': [word(0x5d06), word(0x5d08)],
                  'player_contact_word': word(0x5c8c),
                  'item_bag': [word(0x3c48 + slot * 2) for slot in range(64)],
                  'items': [{'x': x, 'y': y, 'glyph': word(0x1a0c2 + y * 64 + x * 2)}
                            for y in range(13) for x in range(15) if word(0x1c182 + y * 128 + x * 2) & 63 == 4],
                  'buttons': commands.get('buttons', []) if int(index) else [],
                  'buttons2': commands.get('buttons2', []) if int(index) else []}
        if int(index) and commands['frames'] != 1:
            raise ValueError('Passo nativo não unitário')
        cases.setdefault(name, []).append(sample)
    if len(cases) != expected_cases or any([s['index'] for s in samples] != list(range((expected_steps if expected_steps >= 0 else len(samples) - 1) + 1)) for samples in cases.values()):
        raise ValueError('Cobertura dos ensaios incompleta')
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
              'native_reads_matched': checked['sample_count'], 'cases': cases,
              'limitations': [f'{expected_steps} frames por ensaio; extração não certifica a implementação de chute ou luva.' if expected_steps >= 0
                              else 'Ensaios contíguos de comprimentos diferentes; extração não certifica a implementação de chute ou luva.']}
    with Path(output_path).open('x', encoding='utf-8') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
    return {'cases': len(cases), 'native_steps': sum(len(samples) - 1 for samples in cases.values())}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
