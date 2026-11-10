"""Confronta a bolsa observada pelo REA com os dumps independentes do MCP."""
import json
import struct
import sys
from pathlib import Path


def verify(bundle_path, journal_path, evidence_id, script_id):
    bundle = json.loads(Path(bundle_path).read_text(encoding='utf-8'))
    evidence = next(row for row in bundle['records'] if row['evidence_id'] == evidence_id)
    result = evidence['normalized_result']
    if result['messages_truncated']:
        raise ValueError('Captura REA truncada')
    events = [row['payload'] for row in result['messages'] if row.get('type') == 'send'
              and row.get('script_id') == script_id
              and row.get('payload', {}).get('kind') == 'bag-transition']
    journal = json.loads(Path(journal_path).read_text(encoding='utf-8'))
    samples = []
    for capture in journal:
        if capture['name'] != 'read_ram':
            continue
        response = json.loads(capture['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        number = capture['arena']
        transitions = [event for event in events if event['arena'] == number]
        slots = list(struct.unpack_from('<65H', ram, 0x3c48))
        if response['offset'] != 0 or len(ram) != 131072 or not transitions:
            raise ValueError('Cobertura incompleta')
        if ram[0x1ccd] != number - 1 or slots[-1] != 0xffff:
            raise ValueError('Seleção ou terminador incorreto')
        if slots != transitions[-1]['bag_after']:
            raise ValueError(f'Bolsa divergente na arena {number}')
        samples.append({'arena': number, 'frame': response['frame'],
                        'initial_seed': transitions[0]['seed_before'],
                        'internal_index': struct.unpack_from('<H', ram, 0x1a)[0],
                        'phase_at_capture': struct.unpack_from('<H', ram, 0x32)[0],
                        'seed_at_capture': struct.unpack_from('<H', ram, 0xd6)[0],
                        'word_at_capture': struct.unpack_from('<H', ram, 0x400)[0],
                        'slots': slots[:64], 'transitions': transitions})
    if [sample['arena'] for sample in samples] != list(range(1, 13)):
        raise ValueError('As 12 arenas precisam estar presentes')
    return {'status': 'matched', 'evidence_id': evidence_id, 'script_id': script_id,
            'slot_words_compared': 12 * 65, 'samples': samples,
            'limitations': ['Inicialização pode atravessar mais de um retro_run.',
                           'A semente da última mudança da bolsa não é necessariamente a de retorno da rotina.',
                           'Não comprova os efeitos de todos os tipos de item.']}


if __name__ == '__main__':
    report = verify(*sys.argv[1:5])
    with Path(sys.argv[5]).open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print({key: value for key, value in report.items() if key != 'samples'})
