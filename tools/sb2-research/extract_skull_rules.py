"""Extrai tabelas da ROM e transições de coleta do journal REA/MCP validado."""
import hashlib
import json
import struct
import sys
from pathlib import Path

rom = Path(sys.argv[1]).read_bytes()
rows = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
comparison = json.loads(Path(sys.argv[3]).read_text(encoding='utf-8'))
verified = {sample['label'] for sample in comparison['samples']}
speeds = [whole + fraction / 65536 for whole, fraction in struct.iter_unpack('<HH', rom[0x5fb07:0x5fb23])]
skull_table = list(rom[0x5eeb5:0x5eec5])
previous = None
transitions = []
actions = []


def snapshot(ram):
    return {'inventory': list(ram[0x80e0:0x8100]),
            'x': struct.unpack_from('<H', ram, 0x8010)[0] + struct.unpack_from('<H', ram, 0x8012)[0] / 65536,
            'y': struct.unpack_from('<H', ram, 0x8018)[0] + struct.unpack_from('<H', ram, 0x801a)[0] / 65536,
            'speed': struct.unpack_from('<H', ram, 0x80a0)[0] + struct.unpack_from('<H', ram, 0x80a2)[0] / 65536,
            'word': struct.unpack_from('<H', ram, 0x400)[0], 'phase': struct.unpack_from('<H', ram, 0x32)[0],
            'flags': struct.unpack_from('<H', ram, 0x8004)[0],
            'bombs': [[x, y] for y in range(13) for x in range(15)
                      if struct.unpack_from('<H', ram, 0x1c182 + y * 128 + x * 2)[0] & 63 == 3]}


for row in rows:
    if row['name'] == 'load_state':
        previous = None
    if row['name'] != 'read_ram':
        continue
    if row['label'] not in verified:
        raise ValueError('Leitura não verificada')
    ram = bytes.fromhex(json.loads(row['content'][0]['text'])['hex'])
    value = snapshot(ram)
    if previous and previous['inventory'][21] == 0 and value['inventory'][21] != 0:
        if value['inventory'][21] != skull_table[previous['word'] & 15]:
            raise ValueError('Sorteio não corresponde ao frame anterior')
        transitions.append({'label': row['label'], 'before': previous, 'after': value})
    if row['label'].startswith('action-'):
        actions.append({'label': row['label'], **value})
    previous = value
report = {'rom_sha256': hashlib.sha256(rom).hexdigest(), 'evidence_id': comparison['evidence_id'],
          'script_id': comparison['script_id'], 'speed_table_offset': 0x5fb07, 'speeds': speeds,
          'skull_table_offset': 0x5eeb5, 'skull_modes': skull_table,
          'arena_internal_8_skull_modes': list(rom[0x5eec5:0x5eed5]),
          'heart_skull_modes': list(rom[0x5eed5:0x5eee5]),
          'blink_words': list(struct.unpack_from('<44H', rom, 0x5ee5d)),
          'transitions': transitions, 'actions': actions,
          'limitations': ['Tabela normal e seis modos iniciais; contágio e animação completa ainda não certificados.',
                         'A morte em action-1-wait160 pertence ao ensaio e não a um teste de expiração da maldição.']}
with Path(sys.argv[4]).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
print({'transitions': len(transitions), 'modes': sorted({row['after']['inventory'][21] for row in transitions}), 'speeds': speeds})
