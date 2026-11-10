"""Preserva relógio da canaleta observado pelo REA e os trechos da ROM correspondentes."""
import hashlib
import json
import struct
import sys
from pathlib import Path
from verify_effects import verify


def extract(bundle, journal, comparison_path, rom_path, output_path):
    comparison = json.loads(Path(comparison_path).read_text())
    if verify(bundle, journal, comparison['evidence_id'], comparison['script_id']) != comparison:
        raise ValueError('Comparação não corresponde às capturas')
    rom = Path(rom_path).read_bytes()
    digest = hashlib.sha256(rom).hexdigest()
    if digest != 'dcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd':
        raise ValueError('ROM diferente da referência')
    cases = {}
    previous = {}
    for row in json.loads(Path(journal).read_text()):
        if row['name'] != 'read_ram':
            continue
        name, index = row['label'].rsplit('-', 1)
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        state, timer = struct.unpack_from('<hH', ram, 0x5ce2)
        request = previous.get(name, state) < 0 and state == 0
        cases.setdefault(name, []).append({'index': int(index), 'frame': response['frame'],
            'clock': {'index': state, 'timer': timer}, 'request_after_step': request})
        previous[name] = state
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
        'rom_sha256': digest, 'clock_offsets': {'index': '7E5CE2', 'timer': '7E5CE4'},
        'regions': [{'address': hex(0xc00000 + start), 'hex': rom[start:end].hex()}
                    for start, end in [(0x3a92, 0x3ad0), (0x3c61, 0x3c85), (0xe919, 0xe945)]],
        'decoded': ['C03A92 returns if index is negative.',
            'Countdown reaching zero, or starting at zero, reloads three and draws four channel sides.',
            'Drawing uses the current index, then increments it; eleven becomes minus one.',
            'C03C67 writes floor code fourteen for drawn index ten; other indices write one.',
            'C0E919 requests index zero only while inactive; it does not reset the timer.'],
        'cases': cases,
        'limitations': ['Ignition requests reconstructed from observed inactive-to-zero transitions.',
            'Clock replay isolates this component; it is not a full input-to-simulation replay.',
            'Does not model common-flame animation writes that request reactivation.']}
    with Path(output_path).open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return {'cases': len(cases), 'samples': sum(len(rows) for rows in cases.values()),
            'requests': sum(row['request_after_step'] for rows in cases.values() for row in rows)}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
