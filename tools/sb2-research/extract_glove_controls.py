"""Preserva transicoes da luva sem classificar o voo como chute ou salto."""
import json
import struct
import sys
from pathlib import Path
from capture_json import iter_capture_records
from verify_effects import verify


def extract(bundle, journal, comparison, output):
    checked = json.loads(Path(comparison).read_text(encoding='utf-8'))
    if verify(bundle, journal, checked['evidence_id'], checked['script_id'],
              required_regions=(0x12000,)) != checked:
        raise ValueError('Comparacao diverge da evidencia')
    cases = {}
    for record in iter_capture_records(journal):
        if record['name'] != 'read_ram':
            continue
        name, index = record['label'].rsplit('-', 1)
        response = json.loads(record['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        def word(at):
            return struct.unpack_from('<H', ram, at)[0]
        def fixed(at):
            return word(at) + word(at + 2) / 65536
        statics = []
        for slot in range(8):
            base = 0x12000 + slot * 256
            if not word(base) & 0x8000:
                continue
            cell = word(base + 0x0a)
            statics.append({'slot': slot, 'state': word(base),
                            'cell': cell, 'x': cell % 128 // 2 - 1,
                            'y': cell // 128 - 3,
                            'raw_hex': ram[base:base + 256].hex()})
        proxies = []
        for slot in range(4):
            base = 0x8400 + slot * 256
            if word(base):
                proxies.append({'slot': slot, 'state': word(base),
                                'x': fixed(base + 0x10), 'y': fixed(base + 0x18),
                                'static_link': word(base + 0x40),
                                'raw_hex': ram[base:base + 256].hex()})
        cases.setdefault(name, []).append({'index': int(index), 'frame': response['frame'],
            'player': {'state': word(0x8000), 'x': fixed(0x8010), 'y': fixed(0x8018),
                       'raw_hex': ram[0x8000:0x8100].hex()},
            'static_records': statics, 'proxies': proxies})
    if len(cases) != 4 or any([s['index'] for s in samples] != list(range(161))
                              for samples in cases.values()):
        raise ValueError('Cobertura4x160 ausente')
    transitions = {}
    for name, samples in cases.items():
        previous = None
        transitions[name] = []
        for sample in samples:
            states = ([r['state'] for r in sample['static_records']],
                      [r['state'] for r in sample['proxies']])
            if states != previous:
                transitions[name].append({'index': sample['index'],
                                          'static_states': states[0], 'proxy_states': states[1]})
                previous = states
    result = {'evidence_id': checked['evidence_id'], 'reads_matched': checked['sample_count'],
              'cases': cases, 'transitions': transitions,
              'limitations': ['Does not certify all throw directions or full bomb lifecycles.',
                              'Record state9000 and proxy842A/842B retained without generic flight assumptions.']}
    with Path(output).open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print({'cases': len(cases), 'steps': 640, 'transitions': transitions})


if __name__ == '__main__':
    extract(*sys.argv[1:])
