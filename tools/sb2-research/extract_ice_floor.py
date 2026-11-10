"""Preserva percursos especiais e escolhas de junção com origem REA/MCP verificada."""
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
    cases, junctions, prior, buttons = {}, [], {}, []
    for row in json.loads(Path(journal).read_text()):
        if row['name'] == 'advance':
            buttons = row['arguments'].get('buttons', [])
        if row['name'] != 'read_ram':
            continue
        name, index = row['label'].rsplit('-', 1)
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        word = lambda offset: struct.unpack_from('<H', ram, offset)[0]
        value = lambda offset: word(offset) + word(offset + 2) / 65536
        at = word(0x80a8)
        cell = {'x': (at % 128) // 2 - 1, 'y': at // 128 - 3}
        sample = {'label': row['label'], 'index': int(index), 'frame': response['frame'],
            'buttons': buttons, 'x': value(0x8010), 'y': value(0x8018),
            'vx_magnitude': value(0x8014), 'vy_magnitude': value(0x801c),
            'state': word(0x8000), 'mode': word(0x8002), 'latches': word(0x8052),
            'facing': word(0x805e), 'effective_controls': word(0x806e),
            'route_random_word': word(0x406), 'cell': cell,
            'current_code': word(0x1c000 + at), 'background_code': word(0x1d000 + at)}
        previous = prior.get(name)
        if previous and sample['latches'] & 64 and not previous['latches'] & 64:
            if sample['background_code'] != 10:
                raise ValueError('Trava de junção fora do código 10')
            junctions.append({'label': row['label'], 'frame': response['frame'],
                'before': previous['facing'], 'after': sample['facing'],
                'random_word': previous['route_random_word']})
        prior[name] = sample
        cases.setdefault(name, []).append(sample)
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
        'native_reads_matched': comparison['sample_count'], 'rom_sha256': digest,
        'regions': [{'address': hex(0xc00000 + start), 'hex': rom[start:end].hex()}
                    for start, end in [(0x5841, 0x5a59), (0x5eb4d, 0x5eb7f)]],
        'choice_table': [int.from_bytes(rom[i:i+2], 'little') for i in range(0x5eb4d, 0x5eb6d, 2)],
        'reverse_table': [int.from_bytes(rom[i:i+2], 'little') for i in range(0x5eb6d, 0x5eb7f, 2)],
        'cases': cases, 'junctions': junctions,
        'limitations': ['Full automatic-route simulation not yet implemented.',
            'All six observed junction choices use native word 0406 equal to 34.',
            'Lateral input prevents reaching activation in this approach; not proof of cancellation after activation.']}
    with Path(output_path).open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return {'samples': sum(len(samples) for samples in cases.values()), 'junctions': len(junctions)}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
