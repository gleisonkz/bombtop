"""Extrai as tabelas apontadas pelos seletores de espalhamento e rebate."""
import hashlib
import json
import struct
import sys
from pathlib import Path


def extract(rom_path):
    rom = Path(rom_path).read_bytes()
    digest = hashlib.sha256(rom).hexdigest()
    if digest != 'dcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd':
        raise ValueError('ROM diverge da identidade conferida')
    def pointer(offset):
        return int.from_bytes(rom[offset:offset + 3], 'little')
    initial = {group: {direction: pointer(pointer(0x5c0b6 + group * 4) - 0xc00000 + direction * 2)
                      for direction in (2, 4, 8, 16)} for group in range(6)}
    bounce = {direction: pointer(pointer(0x5caa0) - 0xc00000 + direction * 2)
              for direction in (2, 4, 8, 16)}
    paths = {}
    for address in sorted({p for group in initial.values() for p in group.values()} | set(bounce.values())):
        offset = address - 0xc00000
        commands = []
        while struct.unpack_from('<H', rom, offset)[0] != 0xffff:
            command = struct.unpack_from('<HHH', rom, offset)
            if len(commands) >= 100 or command[0] > 3:
                raise ValueError('Tabela fora do formato de voo observado')
            commands.append(command)
            offset += 6
        paths[address] = {'commands': commands,
                          'hex': rom[address - 0xc00000:offset + 2].hex()}
    groups = struct.unpack_from('<16H', rom, 0x5ee0f)
    directions = struct.unpack_from('<16H', rom, 0x5fc6d)
    evidence = {'authority': 'manual static ROM extraction; subset dynamically checked against REA/MCP stage12 captures',
                'rom_sha256': digest, 'paths': paths, 'initial_tables': initial, 'bounce_table': bounce,
                'initial_groups': groups, 'scatter_directions': directions,
                'selector_regions': {hex(0xc00000 + offset): rom[offset:offset + length].hex()
                                     for offset, length in ((0x2bb9, 72), (0x2c59, 78), (0x93d1, 37),
                                                            (0x5c0b6, 24), (0x5caa0, 4),
                                                            (0x5ee0f, 32), (0x5fc6d, 32))},
                'limitations': ['Tabelas extraidas nao certificam todas as interacoes.']}
    Path('docs/sb2/SB2-STAGE12-ITEM-FLIGHT-PATHS-ROM.json').write_text(
        json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    lines = ['/** Tabelas da ROM identificada; gerado por extract_item_flight_paths.py. */',
             'import type { Sb2ItemFlightCommand } from "./sb2-item-flight";',
             'export const SB2_ITEM_FLIGHT_PATHS: Readonly<Record<number, readonly Sb2ItemFlightCommand[]>> = {']
    for address, path in paths.items():
        lines.append(f'  0x{address:x}: {json.dumps(path["commands"])},')
    lines.append('};')
    lines.append('export const SB2_ITEM_INITIAL_PATHS = ' + json.dumps(initial) + ' as const;')
    lines.append('export const SB2_ITEM_BOUNCE_PATHS = ' + json.dumps(bounce) + ' as const;\n')
    lines.append('export const SB2_ITEM_INITIAL_GROUPS = ' + json.dumps(groups) + ' as const;')
    lines.append('export const SB2_ITEM_SCATTER_DIRECTIONS = ' + json.dumps(directions) + ' as const;\n')
    Path('packages/shared/src/sb2-item-flight-paths.ts').write_text('\n'.join(lines), encoding='utf-8')
    print({'paths': len(paths), 'commands': sum(len(p['commands']) for p in paths.values())})


if __name__ == '__main__':
    extract(sys.argv[1])
