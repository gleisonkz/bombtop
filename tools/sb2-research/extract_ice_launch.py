"""Relaciona preparação/lançamento da arena 2 com RAM autenticada por REA/MCP."""
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
        cases.setdefault(name, []).append({
            'index': int(index), 'x': number(0x8010), 'y': number(0x8018),
            'vx': number(0x8014), 'vy': number(0x801c),
            'mode': word(0x8002), 'latches': word(0x8052),
            'animation_timer': word(0x800c), 'animation_pointer': word(0x8070),
            'effective_controls': word(0x806e), 'route_phase': word(0x5d0e),
        })
    launches = []
    for name, samples in cases.items():
        for start in range(1, len(samples)):
            before, first = samples[start - 1:start + 1]
            if before['mode'] & 0x800 or not first['mode'] & 0x800:
                continue
            end = start
            while end < len(samples) and not samples[end]['latches'] & 0x100:
                end += 1
            if end == len(samples):
                raise ValueError(f'Lançamento incompleto: {name}')
            hold, launched = samples[start:end], samples[end]
            if any(s['x'] != first['x'] or s['y'] != first['y'] or
                   s['vx'] or s['vy'] or s['effective_controls'] for s in hold):
                raise ValueError(f'Preparação divergente: {name}')
            if hold[-1]['animation_timer'] != 0xfff:
                raise ValueError(f'Sentinela ausente: {name}')
            launches.append({'case': name, 'before': before, 'hold': hold,
                             'launched': launched, 'stationary_frames': len(hold)})
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
              'native_reads_matched': comparison['sample_count'], 'rom_sha256': digest,
              'launches': launches,
              'regions': [{'address': hex(0xc00000 + a), 'hex': rom[a:b].hex()}
                          for a, b in [(0x4468, 0x4623), (0x5763, 0x5841), (0x20950, 0x20976)]],
              'limitations': ['Only the captured entry is covered; no full-route runtime integration.',
                              'Animation pointers are data addresses, not executable callbacks.']}
    with Path(output_path).open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return {'launches': len(launches), 'stationary_frames': [x['stationary_frames'] for x in launches]}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
