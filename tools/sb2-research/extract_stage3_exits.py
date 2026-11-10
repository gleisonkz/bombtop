"""Preserva entradas e reservas da arena3 com origem REA/MCP confrontada."""
import hashlib
import json
import struct
import sys
from pathlib import Path
from verify_effects import verify


def extract(bundle, journal, comparison_path, rom_path, output_path):
    comparison = json.loads(Path(comparison_path).read_text())
    if verify(bundle, journal, comparison['evidence_id'], comparison['script_id']) != comparison:
        raise ValueError('Comparação divergente')
    rom = Path(rom_path).read_bytes()
    digest = hashlib.sha256(rom).hexdigest()
    if digest != 'dcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd':
        raise ValueError('ROM divergente')
    cases = {}
    for row in json.loads(Path(journal).read_text()):
        if row['name'] != 'read_ram':
            continue
        name, index = row['label'].rsplit('-', 1)
        ram = bytes.fromhex(json.loads(row['content'][0]['text'])['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        number = lambda offset: word(offset) + word(offset + 2) / 65536
        players = []
        for seat in range(2):
            base = 0x8000 + seat * 256
            players.append({'x': number(base + 0x10), 'y': number(base + 0x18),
                'vy': number(base + 0x1c) * (-1 if word(base) & 2 else 1),
                'mode': word(base + 2), 'latches': word(base + 0x52)})
        cases.setdefault(name, []).append({'index': int(index), 'players': players,
            'gate': word(0x5d04), 'gate_owners': [word(0x5d06), word(0x5d08)],
            'reservations': [{'x': x, 'y': y, 'code': word(0x1c182 + y * 128 + x * 2)}
                for y in [0, 12] for x in [3, 11] if word(0x1c182 + y * 128 + x * 2) == 251]})
    entries = []
    for name, samples in cases.items():
        for prior, current in zip(samples, samples[1:]):
            for seat, (before, after) in enumerate(zip(prior['players'], current['players'])):
                if abs(after['y'] - before['y']) > 200:
                    entries.append({'case': name, 'index': current['index'], 'seat': seat,
                        'entry': 'top' if before['y'] < 100 else 'bottom', 'before': before, 'after': after})
    if len(entries) != 4:
        raise ValueError('Cobertura de quatro aberturas incompleta')
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
        'native_reads_matched': comparison['sample_count'], 'rom_sha256': digest,
        'regions': [{'address': hex(0xc00000 + a), 'hex': rom[a:b].hex()}
                    for a, b in [(0x4de1, 0x5182), (0x5182, 0x5287)]],
        'entries': entries, 'cases': cases,
        'limitations': ['No occupied exits, bombs, alternate inventory or simultaneous traversal certified.',
                        'Pixel skipping after repositioning and reservation lifecycle not integrated.']}
    with Path(output_path).open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return {'samples': sum(map(len, cases.values())), 'entries': len(entries)}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
