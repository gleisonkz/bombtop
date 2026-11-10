"""Extrai tabelas de itens da ROM e a ordem interna observada pelo MCP."""
import hashlib
import json
import struct
import sys
from pathlib import Path

rom = Path(sys.argv[1]).read_bytes()
journal = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
glyphs = list(struct.unpack_from('<16H', rom, 0x5f205))
arenas = []
for row in journal:
    if row['name'] != 'read_ram':
        continue
    response = json.loads(row['content'][0]['text'])
    ram = bytes.fromhex(response['hex'])
    number, internal = row['arena'], struct.unpack_from('<H', ram, 0x1a)[0]
    if ram[0x1ccd] != number - 1:
        raise ValueError('Seleção nativa divergente')
    pointer = int.from_bytes(rom[0x5f225 + internal * 4:0x5f228 + internal * 4], 'little')
    offset = pointer & 0xfffff
    counts = list(struct.unpack_from('<17H', rom, offset))
    if counts.pop() != 0xffff or sum(counts) > 64:
        raise ValueError('Tabela de itens inválida')
    arenas.append({'number': number, 'internal_index': internal, 'file_offset': offset, 'counts': counts})
if [arena['number'] for arena in arenas] != list(range(1, 13)):
    raise ValueError('Cobertura incompleta das arenas')
report = {'rom_sha256': hashlib.sha256(rom).hexdigest(), 'glyph_table_offset': 0x5f205,
          'pointer_table_offset': 0x5f225, 'glyphs': glyphs, 'arenas': arenas,
          'method': 'Leitura direta de tabelas e decodificação manual parcial 65816; validação dinâmica separada.',
          'regions': [{'offset': offset, 'hex': rom[offset:offset+length].hex()} for offset, length in
                      [(0xcaa, 0x89), (0x1cf2, 0x71), (0xde24, 0x40), (0x5f145, 0x2a8)]]}
with Path(sys.argv[3]).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
source = ['/** Tabelas extraídas da ROM; ordem interna confrontada com as 12 seleções MCP. */',
          'import type { Sb2ArenaNumber } from "./sb2-stage-captures";',
          f'export const SB2_ITEM_GLYPHS = {json.dumps(glyphs)} as const;',
          'export const SB2_ITEM_COUNTS = {']
source += [f"  {arena['number']}: {json.dumps(arena['counts'])}," for arena in arenas]
source += ['} as const satisfies Readonly<Record<Sb2ArenaNumber, readonly number[]>>;', '']
with Path(sys.argv[4]).open('x', encoding='utf-8') as stream:
    stream.write('\n'.join(source))
print({'arenas': len(arenas), 'glyphs': len(glyphs), 'counts': [sum(arena['counts']) for arena in arenas]})
