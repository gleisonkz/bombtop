"""Confere as fases válidas do ensaio de esteiras, sem misturar coletores."""
import json
import struct
import sys
from pathlib import Path
from extract_grids import BASES, WIDTH, HEIGHT, ROW_BYTES, CELL_BYTES


def verify(bundle_path, evidence_id, first_journal, confirmed_journal):
    bundle = json.loads(Path(bundle_path).read_text())
    evidence = next(record for record in bundle['records'] if record['evidence_id'] == evidence_id)
    result = evidence['normalized_result']
    if result['messages_truncated']:
        raise ValueError('Mensagens truncadas')
    observations = [message['payload'] for message in result['messages']
                    if message.get('type') == 'send' and message.get('payload', {}).get('kind')
                    in ('conveyor-observation', 'conveyor-oam-observation')]
    phases = [('conveyor-observation', 1, first_journal),
              ('conveyor-oam-observation', 28, confirmed_journal)]
    output = []
    for kind, first_sample, journal in phases:
        sources = [sample for sample in observations if sample['kind'] == kind and sample['sample'] >= first_sample]
        captures = [record for record in json.loads(Path(journal).read_text()) if record['name'] == 'read_ram']
        if not sources or len(sources) != len(captures):
            raise ValueError('Cobertura diferente na fase ' + kind)
        for source, capture in zip(sources, captures):
            response = json.loads(capture['content'][0]['text'])
            ram = bytes.fromhex(response['hex'])
            if response['offset'] != 0 or len(ram) != 131072 or source['selection_byte_1ccd'] != 7 or ram[0x1ccd] != 7:
                raise ValueError('Dump incompleto ou arena incorreta')
            for name, base in BASES.items():
                expected = [[struct.unpack_from('<H', ram, base + y * ROW_BYTES + x * CELL_BYTES)[0]
                             for x in range(WIDTH)] for y in range(HEIGHT)]
                if expected != source['grids'][name]:
                    raise ValueError('Grade divergente')
            if len(source['players']) != 4:
                raise ValueError('Jogadores incompletos')
            players = []
            for seat, player in enumerate(source['players']):
                raw = ram[0x8000 + seat * 256:0x8100 + seat * 256]
                if player['seat'] != seat or player['raw_hex'] != raw.hex():
                    raise ValueError('Jogador divergente')
                x, xf = struct.unpack_from('<HH', raw, 0x10)
                y, yf = struct.unpack_from('<HH', raw, 0x18)
                players.append({'seat': seat, 'x': x + xf / 65536, 'y': y + yf / 65536})
            for prefix, size in [('candidate_bomb_region', 256), ('oam_bomb_region', 4), ('control_region', 1024)]:
                if prefix + '_hex' not in source:
                    continue
                offset = source[prefix + '_offset']
                if source[prefix + '_hex'] != ram[offset:offset + size].hex():
                    raise ValueError('Região divergente: ' + prefix)
            entry = {'label': capture['label'], 'phase': kind, 'rea_sample': source['sample'],
                     'frame': response['frame'], 'players': players}
            if 'oam_bomb_region_hex' in source:
                entry['bomb_oam'] = list(bytes.fromhex(source['oam_bomb_region_hex']))
            output.append(entry)
    return {'status': 'matched', 'evidence_id': evidence_id, 'sample_count': len(output),
            'grid_cells_compared': len(output) * 390, 'player_bytes_compared': len(output) * 1024,
            'excluded': 'Amostras 1..27 da fase OAM: coletor MCP vazio após troca de binding no REPL; não utilizadas.',
            'limitations': ['Região 0x12000 permanece candidata, sem semântica atribuída.',
                           'Rótulos switch-upper/lower da primeira fase indicam intenção; os comandos não foram alcançados.'],
            'samples': output}


if __name__ == '__main__':
    report = verify(*sys.argv[1:5])
    with Path(sys.argv[5]).open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print({key: value for key, value in report.items() if key != 'samples'})
