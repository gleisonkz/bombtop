"""Preserva os trechos 65816 usados na resolução do vetor de movimento."""
import hashlib
import json
import sys
from pathlib import Path

rom = Path(sys.argv[1]).read_bytes()
report = {'rom_sha256': hashlib.sha256(rom).hexdigest(),
          'dispatch_table_offset': 0xac0b,
          'dispatch_pointers': [int.from_bytes(rom[0xac0b + i * 4:0xac0e + i * 4], 'little') for i in range(16)],
          'diagonal_handlers': {'right_down': 0xb62d, 'left_down': 0xb6a8, 'right_up': 0xb723, 'left_up': 0xb79e},
          'corners': [[7, 8], [7, -7], [-8, -7], [-8, 8]],
          'facing_codes': {'right': 2, 'left': 4, 'down': 8, 'up': 16},
          'regions': [{'offset': start, 'hex': rom[start:end].hex()} for start, end in
                      [(0x53e1, 0x57a0), (0xa8d3, 0xaa13), (0xac0b, 0xac4b), (0xb505, 0xb854),
                       (0xb94d, 0xb97b), (0xbea6, 0xc01b), (0xc34d, 0xc54b)]],
          'method': 'Decodificação manual parcial dos despachos/flags; validação por replay de capturas REA/MCP separada.',
          'limitations': ['Não constitui uma desmontagem completa da ROM nem valida todas as colisões de objetos.']}
with Path(sys.argv[2]).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
print({'regions': len(report['regions']), 'dispatches': len(report['dispatch_pointers'])})
