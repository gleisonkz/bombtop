"""Relaciona a saída antecipada da varredura de bombas à pausa observada no Snes9x."""
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
    previous = {}
    holds = []
    for row in json.loads(Path(journal).read_text()):
        if row['name'] != 'read_ram':
            continue
        name = row['label'].rsplit('-', 1)[0]
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        counter = word(0x32)
        if counter & 1:
            continue
        current = {'counter': counter, 'first': word(0x12000), 'second': word(0x12100),
                   'second_timer': ram[0x12104]}
        prior = previous.get(name)
        if prior and prior['second'] == current['second'] == 0x8000:
            if prior['second_timer'] == current['second_timer']:
                if prior['first'] != 0x8000 or current['first'] != 0xc000:
                    raise ValueError('Pausa sem transição da entrada anterior')
                holds.append({'case': name, 'label': row['label'], 'frame': response['frame'],
                              'before': prior, 'after': current})
        previous[name] = current
    if len(holds) != 3:
        raise ValueError('Cobertura inesperada da pausa')
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
        'rom_sha256': digest,
        'regions': [{'address': hex(0xc00000 + start), 'hex': rom[start:end].hex()}
                    for start, end in [(0xe0ab, 0xe0f0), (0xe980, 0xe9e0)]],
        'decoded': ['C0E0AB updates bomb entries only on even native counters.',
            'An entry already carrying bit 4000 executes its flame animation and continues.',
            'A normal entry that acquires bit 4000 during C0E980 returns from the entire scan.',
            'Later static entries therefore miss that even update.'],
        'holds': holds,
        'limitations': ['First two static entries only; slot reuse and longer lists require captures.',
            'Moving bomb entities have a separate update path.']}
    with Path(output_path).open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return {'matched_holds': len(holds)}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
