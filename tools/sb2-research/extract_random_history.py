"""Extrai o histórico0400..041E somente após confrontar REA/MCP."""
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
        cases.setdefault(name, []).append({'index': int(index), 'counter': word(0x32),
            'seed': word(0xd6), 'history': [word(i) for i in range(0x400, 0x420, 2)]})
    result = {'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'],
              'native_reads_matched': comparison['sample_count'], 'rom_sha256': digest,
              'region': {'address': '0xc00caa', 'hex': rom[0xcaa:0xcdf].hex()}, 'cases': cases,
              'limitations': ['Replay starts from captured history; initial match history is not established here.']}
    with Path(output_path).open('x', encoding='utf-8') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return {'samples': sum(map(len, cases.values())), 'steps': sum(len(x) - 1 for x in cases.values())}


if __name__ == '__main__':
    print(extract(*sys.argv[1:]))
