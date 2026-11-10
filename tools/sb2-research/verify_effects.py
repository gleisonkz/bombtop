"""Confronta grades e estruturas de jogadores no ensaio de pisos."""
import json
import struct
import sys
from pathlib import Path
from extract_grids import BASES, WIDTH, HEIGHT, ROW_BYTES, CELL_BYTES
from capture_json import iter_capture_records
from itertools import zip_longest


def verify(bundle_path, journal_path, evidence_id, script_id=None, required_regions=()):
    bundle = json.loads(Path(bundle_path).read_text(encoding='utf-8'))
    evidence = next(record for record in bundle['records'] if record['evidence_id'] == evidence_id)
    result = evidence['normalized_result']
    # O bundle acumula observacoes anteriores; so a evidencia selecionada e
    # necessaria para este confronto. Liberar as demais antes do journal.
    del bundle
    observed = [message['payload'] for message in result['messages']
                if message.get('type') == 'send' and message.get('payload', {}).get('kind') == 'arena-effects'
                and (script_id is None or message.get('script_id') == script_id)]
    captured = (record for record in iter_capture_records(journal_path) if record['name'] == 'read_ram')
    if not observed:
        raise ValueError('Cobertura REA/MCP diferente')
    # A fila pertence à sessão, inclusive scripts já descarregados. Só aceitar
    # truncamento externo ao script escolhido quando sua sequência inteira existe.
    complete_script = script_id is not None and [row['sample'] for row in observed] == list(range(1, len(observed) + 1))
    if result['messages_truncated'] and not complete_script:
        raise ValueError('Mensagens REA truncadas sem cobertura completa do script escolhido')
    samples = []
    for source, capture in zip_longest(observed, captured):
        if source is None or capture is None:
            raise ValueError('Cobertura REA/MCP diferente')
        if not set(required_regions).issubset({region['offset'] for region in source.get('candidate_regions', [])}):
            raise ValueError('Regiao obrigatoria ausente no observador REA')
        response = json.loads(capture['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        if response['offset'] != 0 or len(ram) != 131072:
            raise ValueError('Dump incompleto')
        if source['selection_byte_1ccd'] != capture['arena'] - 1 or ram[0x1ccd] != source['selection_byte_1ccd']:
            raise ValueError('Arena incorreta')
        for name, base in BASES.items():
            expected = [[struct.unpack_from('<H', ram, base + y * ROW_BYTES + x * CELL_BYTES)[0]
                         for x in range(WIDTH)] for y in range(HEIGHT)]
            if source['grids'][name] != expected:
                raise ValueError(f"Grade divergente: {capture['label']}")
        for glyph in source.get('pad_glyphs', []):
            if glyph['value'] != struct.unpack_from('<H', ram, glyph['offset'])[0]:
                raise ValueError(f"Glifo divergente: {capture['label']}")
        for glyph in source.get('item_glyphs', []):
            if glyph['value'] != struct.unpack_from('<H', ram, glyph['offset'])[0]:
                raise ValueError(f"Glifo de item divergente: {capture['label']}")
        if 'pad_random_word_0400' in source and source['pad_random_word_0400'] != struct.unpack_from('<H', ram, 0x400)[0]:
            raise ValueError(f"Palavra de sorteio divergente: {capture['label']}")
        for slot in source.get('candidate_bomb_slots', []):
            if slot['raw_hex'] != ram[slot['offset']:slot['offset'] + 256].hex():
                raise ValueError(f"Estrutura candidata divergente: {capture['label']}")
        for region in source.get('candidate_regions', []):
            size = len(region['raw_hex']) // 2
            if region['raw_hex'] != ram[region['offset']:region['offset'] + size].hex():
                raise ValueError(f"Região candidata divergente: {capture['label']}")
        if len(source['players']) != 4:
            raise ValueError('Jogadores incompletos')
        players = []
        for seat, player in enumerate(source['players']):
            raw = ram[0x8000 + seat * 256:0x8100 + seat * 256]
            if player['seat'] != seat or player['raw_hex'] != raw.hex():
                raise ValueError(f"Jogador divergente: {capture['label']}")
            x, xf = struct.unpack_from('<HH', raw, 0x10)
            y, yf = struct.unpack_from('<HH', raw, 0x18)
            players.append({'seat': seat, 'x': x + xf / 65536, 'y': y + yf / 65536,
                            'state_word': struct.unpack_from('<H', raw)[0]})
        samples.append({'arena': capture['arena'], 'label': capture['label'], 'frame': response['frame'],
                        'rea_sample': source['sample'], 'players': players})
    return {'status': 'matched', 'evidence_id': evidence_id, 'sample_count': len(samples),
            'script_id': script_id,
            'session_messages_truncated': result['messages_truncated'],
            'selected_script_samples_complete': complete_script,
            'pad_glyph_words_compared': sum(len(sample.get('pad_glyphs', [])) for sample in observed),
            'item_glyph_words_compared': sum(len(sample.get('item_glyphs', [])) for sample in observed),
            'candidate_bomb_bytes_compared': sum(len(sample.get('candidate_bomb_slots', [])) * 256 for sample in observed),
            'candidate_region_bytes_compared': sum(len(region['raw_hex']) // 2 for sample in observed for region in sample.get('candidate_regions', [])),
            'grid_cells_compared': len(samples) * WIDTH * HEIGHT * 2,
            'entity_bytes_compared': len(samples) * 1024, 'samples': samples,
            'limitations': ['Ensaios com dois jogadores humanos e COMs desligados.',
                           'Não valida todas as interações, reativações ou danos.']}


if __name__ == '__main__':
    report = verify(*sys.argv[1:4], script_id=sys.argv[5] if len(sys.argv) > 5 else None)
    with Path(sys.argv[4]).open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print({key: value for key, value in report.items() if key != 'samples'})
