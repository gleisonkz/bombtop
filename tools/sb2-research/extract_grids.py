"""Exporta valores observados na WRAM; não preenche códigos desconhecidos."""
import hashlib
import json
import struct
import sys
from collections import Counter
from pathlib import Path

WIDTH, HEIGHT = 15, 13
ROW_BYTES, CELL_BYTES = 128, 2
BASES = {'current': 0x1C182, 'background': 0x1D182}


def extract(journal_path):
    raw_journal = Path(journal_path).read_bytes()
    journal = json.loads(raw_journal)
    arenas = []
    image = None
    for record in journal['records']:
        for block in record['content']:
            if block['type'] == 'image':
                image = block['path']
        if record['step']['name'] != 'read_ram':
            continue
        if record.get('isError'):
            raise ValueError('Leitura MCP falhou')
        response = json.loads(record['content'][0]['text'])
        ram = bytes.fromhex(response['hex'])
        if response['offset'] != 0 or len(ram) != 131072:
            raise ValueError('É necessário dump integral da WRAM')
        grids = {name: [[struct.unpack_from('<H', ram, base + y * ROW_BYTES + x * CELL_BYTES)[0]
                         for x in range(WIDTH)] for y in range(HEIGHT)] for name, base in BASES.items()}
        arenas.append({'capture_ordinal': len(arenas) + 1, 'image': image,
                       'selection_byte_1ccd': ram[0x1ccd],
                       'selected_arena_number': ram[0x1ccd] + 1,
                       'frame': response['frame'], 'rom_sha256': response['rom_sha256'],
                       'core_sha256': response['core_sha256'],
                       'ram_sha256': hashlib.sha256(ram).hexdigest(), 'grids': grids,
                       'counts': {name: dict(sorted(Counter(v for row in grid for v in row).items()))
                                  for name, grid in grids.items()}})
    return {'status': 'research-not-gameplay-validated', 'journal': str(Path(journal_path)),
            'journal_sha256': hashlib.sha256(raw_journal).hexdigest(),
            'width': WIDTH, 'height': HEIGHT, 'row_bytes': ROW_BYTES, 'cell_bytes': CELL_BYTES,
            'wram_offsets': BASES, 'cell_format': 'uint16-le',
            'limitations': ['Ordinais precisam ser confrontados com seleção capturada.',
                           'Códigos de chão especial ainda sem semântica atribuída.',
                           'Posições iniciais de jogadores não extraídas por este programa.',
                           'Não comprova PRNG nem distribuição geral de blocos.',
                           'Não constitui validação pelo REA.'], 'arenas': arenas}


if __name__ == '__main__':
    result = extract(sys.argv[1])
    destination = Path(sys.argv[2])
    with destination.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    for arena in result['arenas']:
        print(arena['capture_ordinal'], arena['frame'], arena['counts']['current'])
