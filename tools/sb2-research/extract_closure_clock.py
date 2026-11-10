"""Confere registros de fechamento/relogio e extrai tabelas da ROM identificada."""
import hashlib
import json
import struct
import sys
from pathlib import Path
from capture_json import iter_capture_records
from verify_effects import verify


def extract(rom_path, bundle, journal, output):
    rom = Path(rom_path).read_bytes()
    digest = hashlib.sha256(rom).hexdigest()
    if digest != 'dcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd':
        raise ValueError('ROM inesperada')
    checked = verify(bundle, journal,
        'ev_787e70e42883ddc833c87ff0980df6ac8de9e9dca9b494e10231c7b94fd16db2',
        '65a4ac29-6b87-4200-b059-acee18d9128a', required_regions=(0x5e00, 0x10b00))
    samples = []
    for row in iter_capture_records(journal):
        if row['name'] != 'read_ram':
            continue
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        def word(at):
            return struct.unpack_from('<H', ram, at)[0]
        samples.append({'index': int(row['label'].rsplit('-', 1)[1]), 'frame': response['frame'],
            'clock': {'minutes': word(0x5e10), 'seconds': word(0x5e12), 'frame': word(0x5e14)},
            'closure': {'flags': word(0x5d0e), 'timer': word(0x5d10),
                        'index': word(0x5d12), 'animation': word(0x5d14),
                        'cell': word(0x5d16), 'extended': bool(word(0x1c68))},
            'players': [{'x': word(0x8010 + seat * 256), 'y': word(0x8018 + seat * 256),
                         'alive': word(0x8000 + seat * 256) < 0x9800} for seat in range(2)],
            'grid': [[word(0x1c182 + y * 128 + x * 2) for x in range(15)] for y in range(13)]})
    if [s['index'] for s in samples] != list(range(601)):
        raise ValueError('Cobertura601 ausente')
    sequence = list(rom[0x5e1c9:0x5e25a])
    animation = list(struct.unpack_from('<5H', rom, 0x5e25a))
    if sequence[-1] != 255 or animation[-1] != 65535:
        raise ValueError('Terminadores inesperados')
    Path(output).write_text(json.dumps({'comparison': checked, 'samples': samples}, indent=2) + '\n', encoding='utf-8')
    Path('docs/sb2/SB2-CLOSURE-CLOCK-ROM.json').write_text(json.dumps({
        'rom_sha256': digest, 'sequence': sequence, 'animation': animation,
        'regions': {hex(0xc00000 + at): rom[at:at + size].hex() for at, size in
                    [(0xd5bb, 240), (0xd83e, 80), (0x11c1c, 92)]},
        'limitations': ['Runtime capture certifies first23 positions and pause after death; remaining sequence is ROM-derived.']}, indent=2) + '\n', encoding='utf-8')
    Path('packages/shared/src/sb2-closure-tables.ts').write_text(
        '/** Gerado por extract_closure_clock.py a partir da ROM conferida. */\n'
        + 'export const SB2_CLOSURE_SEQUENCE = ' + json.dumps(sequence) + ' as const;\n'
        + 'export const SB2_CLOSURE_ANIMATION = ' + json.dumps(animation) + ' as const;\n', encoding='utf-8')
    print({'reads_matched': checked['sample_count'], 'samples': len(samples)})


if __name__ == '__main__':
    extract(*sys.argv[1:])
