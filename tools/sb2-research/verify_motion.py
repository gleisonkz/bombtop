"""Compara estruturas completas de jogadores entre REA e MCP."""
import json
import struct
import sys
from pathlib import Path


def verify(bundle_path, journal_path, evidence_id):
    bundle = json.loads(Path(bundle_path).read_text())
    evidence = next(record for record in bundle['records'] if record['evidence_id'] == evidence_id)
    result = evidence['normalized_result']
    if result['messages_truncated']:
        raise ValueError('Observação REA truncada')
    samples = [message['payload'] for message in result['messages']
               if message.get('type') == 'send' and message.get('payload', {}).get('kind') == 'native-players']
    captures = [record for record in json.loads(Path(journal_path).read_text()) if record['name'] == 'read_ram']
    if not samples or len(samples) != len(captures):
        raise ValueError('Quantidade de amostras diferente')
    output = []
    for sample, capture in zip(samples, captures):
        response = json.loads(capture['content'][0]['text'])
        raw = bytes.fromhex(response['hex'])
        if response['offset'] != 0x8000 or len(raw) != 1024:
            raise ValueError('Intervalo de estruturas incorreto')
        if sample['selection_byte_1ccd'] != capture['arena'] - 1:
            raise ValueError('Arena não corresponde à seleção REA')
        if len(sample['players']) != 4:
            raise ValueError('Observação REA não contém os quatro jogadores')
        players = []
        for seat, player in enumerate(sample['players']):
            entity = raw[seat * 256:(seat + 1) * 256]
            if player['seat'] != seat or player['raw_hex'] != entity.hex():
                raise ValueError(f"Estrutura divergente: {capture['label']}, jogador {seat}")
            x, xf = struct.unpack_from('<HH', entity, 0x10)
            y, yf = struct.unpack_from('<HH', entity, 0x18)
            if (x, y) != (player['x'], player['y']):
                raise ValueError('Coordenada e bytes divergentes')
            players.append({'seat': seat, 'x': x + xf / 65536, 'y': y + yf / 65536,
                            'flags': struct.unpack_from('<H', entity, 4)[0],
                            'skull_mode': entity[0xf5], 'skull_cursor': entity[0xf9],
                            'skull_timer': struct.unpack_from('<H', entity, 0xfc)[0]})
        output.append({'arena': capture['arena'], 'label': capture['label'],
                       'rea_sample': sample['sample'], 'frame': response['frame'], 'players': players})
    return {'status': 'matched', 'evidence_id': evidence_id, 'sample_count': len(samples),
            'entity_count': len(samples) * 4, 'bytes_compared': len(samples) * 1024,
            'limitations': ['Coordenadas Y durante salto incluem a elevação visual.',
                           'Frames são do núcleo PAL; ainda não convertidos ao relógio do Bombtop.',
                           'Coincidência de estruturas não valida todas as regras de cada arena.'],
            'samples': output}


if __name__ == '__main__':
    report = verify(*sys.argv[1:4])
    with Path(sys.argv[4]).open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print({key: value for key, value in report.items() if key != 'samples'})
