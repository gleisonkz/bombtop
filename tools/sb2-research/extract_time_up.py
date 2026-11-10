"""Confere as capturas TIME-UP A/B (REA x MCP) e extrai relogio, fechamento e jogadores ate o fim do tempo.

Uso: python extract_time_up.py bundleA journalA bundleB journalB saida.json
"""
import json
import struct
import sys
from pathlib import Path
from capture_json import iter_capture_records
from verify_effects import verify

CASES = (
    ('A', 'ev_8d48cb7193611e0364f01b33cf9d04b45bbcf4eb19f5972d3791fe91c1919d18', '09dbbe32-f19d-458e-8393-3e043ae22fa7'),
    ('B', 'ev_b11d768bce696d2bb88cef03c925e2403df52682ad81841629a5fd19c6e167b9', 'f9081bef-ab33-40d5-9a06-19218efbe548'),
)


def samples_of(journal):
    out = []
    previous = None
    for row in iter_capture_records(journal):
        if row['name'] != 'read_ram':
            continue
        response = json.loads(row['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])

        def word(at):
            return struct.unpack_from('<H', ram, at)[0]
        changed = None
        if previous is not None:
            changed = [hex(i) for i in range(0, len(ram), 2) if ram[i:i + 2] != previous[i:i + 2]]
        out.append({'frame': response['frame'],
                    'clock': {'minutes': word(0x5e10), 'seconds': word(0x5e12), 'frame': word(0x5e14)},
                    'closure': {'flags': word(0x5d0e), 'timer': word(0x5d10), 'index': word(0x5d12),
                                'animation': word(0x5d14), 'cell': word(0x5d16), 'extended': bool(word(0x1c68))},
                    'players': [{'x': word(0x8010 + seat * 256), 'y': word(0x8018 + seat * 256),
                                 'state': word(0x8000 + seat * 256),
                                 'alive': word(0x8000 + seat * 256) < 0x9800} for seat in range(4)],
                    'changed_words': len(changed) if changed is not None else None,
                    'low_changed': [c for c in (changed or []) if int(c, 16) < 0x200][:40]})
        previous = ram
    return out


def main(bundle_a, journal_a, bundle_b, journal_b, output):
    report = {'cases': {}}
    for (name, evidence, script), (bundle, journal) in zip(CASES, ((bundle_a, journal_a), (bundle_b, journal_b))):
        checked = verify(bundle, journal, evidence, script, required_regions=(0x5e00,))
        report['cases'][name] = {'evidence_id': evidence, 'script_id': script, 'comparison': checked,
                                 'samples': samples_of(journal)}
        print(name, {'reads_matched': checked['sample_count']})
    Path(output).write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main(*sys.argv[1:])
