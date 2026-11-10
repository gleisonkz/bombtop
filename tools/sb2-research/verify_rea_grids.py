"""Confronta duas leituras independentes da WRAM do mesmo estado."""
import json
import struct
import sys
from pathlib import Path
from extract_grids import BASES, WIDTH, HEIGHT, ROW_BYTES, CELL_BYTES


def verify(bundle_path, mcp_path, session_id=None):
    bundle = json.loads(Path(bundle_path).read_text())
    samples = []
    evidence_ids = []
    sessions = {record['parameters']['session_id'] for record in bundle['records']
                if record['operation'] == 'frida_session_status'}
    if session_id is None and len(sessions) > 1:
        raise ValueError('Informe a sessão Frida para evitar misturar ensaios')
    for record in bundle['records']:
        if record['operation'] != 'frida_session_status':
            continue
        if session_id is not None and record['parameters']['session_id'] != session_id:
            continue
        result = record['normalized_result']
        if result['messages_truncated']:
            raise ValueError('Mensagens Frida truncadas')
        evidence_ids.append(record['evidence_id'])
        samples.extend(message['payload'] for message in result['messages']
                       if message.get('type') == 'send' and message.get('payload', {}).get('kind') == 'wram-grids')
    mcp = json.loads(Path(mcp_path).read_text())
    if len(samples) != len(mcp) or not samples:
        raise ValueError('Cobertura diferente ou vazia')
    results = []
    for sample, capture in zip(samples, mcp):
        response = json.loads(capture['data']['content'][0]['text'])
        if sample['selection_byte_1ccd'] != capture['arena'] - 1:
            raise ValueError('A seleção observada não corresponde à arena informada')
        ram = bytes.fromhex(response['hex'])
        if response['offset'] != 0 or len(ram) != 131072:
            raise ValueError('Dump MCP incompleto')
        for name, base in BASES.items():
            expected = [[struct.unpack_from('<H', ram, base + y * ROW_BYTES + x * CELL_BYTES)[0]
                         for x in range(WIDTH)] for y in range(HEIGHT)]
            if expected != sample['grids'][name]:
                raise ValueError(f"Diferença na arena {capture['arena']}, grade {name}")
        results.append({'arena': capture['arena'], 'rea_sample': sample['sample'],
                        'selection_byte_1ccd': sample['selection_byte_1ccd'],
                        'frame': response['frame'], 'cells_compared': WIDTH * HEIGHT * len(BASES)})
    return {'status': 'matched', 'evidence_ids': evidence_ids, 'arenas': results,
            'cells_compared': sum(row['cells_compared'] for row in results),
            'limitations': ['Confirma valores da memória nos estados selecionados, não semântica completa.',
                           'O vínculo de ROM/núcleo é registrado pelo MCP; REA/Frida declara identidade de artefato indisponível.']}


if __name__ == '__main__':
    result = verify(sys.argv[1], sys.argv[2], sys.argv[4] if len(sys.argv) > 4 else None)
    with Path(sys.argv[3]).open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps(result, indent=2))
