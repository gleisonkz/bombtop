"""Extrai somente trajetorias apontadas pelos proxies nativos capturados."""
import hashlib
import json
import struct
import sys
from pathlib import Path


def extract(rom_path):
    rom = Path(rom_path).read_bytes()
    digest = hashlib.sha256(rom).hexdigest()
    if digest != 'dcf9cd8615a08c8050fd102702291808cafaffd428013f2dda3164130b7f08fd':
        raise ValueError('ROM inesperada')
    replay = json.loads(Path('docs/sb2/SB2-STAGE12-GLOVE-CONTROLS-REPLAY.json').read_text())
    paths = {}
    for name, samples in replay['cases'].items():
        birth = next((s for s in samples if s['proxies']), None)
        if birth is None:
            continue
        raw = bytes.fromhex(birth['proxies'][0]['raw_hex'])
        address = int.from_bytes(raw[0x43:0x46], 'little')
        offset = address - 0xc00000
        commands = []
        while struct.unpack_from('<H', rom, offset)[0] != 0xffff:
            flags, vx, vy = struct.unpack_from('<HHH', rom, offset)
            if flags > 3 or len(commands) >= 100:
                raise ValueError('Trajetoria fora do formato conhecido')
            commands.append([flags, vx, vy])
            offset += 6
        paths[name] = {'address': address, 'commands': commands,
                       'raw_hex': rom[address - 0xc00000:offset + 2].hex(),
                       'birth_index': birth['index']}
    if set(paths) != {'glove-repress', 'glove-right-release'}:
        raise ValueError('Cobertura horizontal esperada ausente')
    vertical = json.loads(Path('docs/sb2/SB2-STAGE12-GLOVE-VERTICAL-CLASSIFIED-REPLAY.json').read_text())
    for name, samples in vertical['cases'].items():
        birth = next(s for s in samples if s['thrown_bombs'])
        raw = bytes.fromhex(birth['thrown_bombs'][0]['raw_hex'])
        address = int.from_bytes(raw[0x43:0x46], 'little')
        offset = address - 0xc00000
        commands = []
        while struct.unpack_from('<H', rom, offset)[0] != 0xffff:
            command = list(struct.unpack_from('<HHH', rom, offset))
            if command[0] > 3 or len(commands) >= 100:
                raise ValueError('Trajetoria vertical inesperada')
            commands.append(command)
            offset += 6
        paths[name] = {'address': address, 'commands': commands,
                       'raw_hex': rom[address - 0xc00000:offset + 2].hex(),
                       'birth_index': birth['index']}
    Path('docs/sb2/SB2-STAGE12-GLOVE-PATHS-ROM.json').write_text(json.dumps({
        'rom_sha256': digest, 'evidence_id': replay['evidence_id'], 'paths': paths,
        'vertical_evidence_id': vertical['evidence_id'],
        'limitations': ['Tables alone do not certify every collision or multiple-player interaction.']},
        indent=2) + '\n', encoding='utf-8')
    Path('packages/shared/src/sb2-glove-paths.ts').write_text(
        '/** Trajetorias da luva extraidas por extract_glove_paths.py. */\n'
        + 'import type { Sb2ItemFlightCommand } from "./sb2-item-flight";\n'
        + 'export const SB2_GLOVE_PATHS: Record<"left" | "right" | "up" | "down", readonly Sb2ItemFlightCommand[]> = '
        + json.dumps({'left': paths['glove-repress']['commands'],
                      'right': paths['glove-right-release']['commands'],
                      'up': paths['glove-life-vertical-up']['commands'],
                      'down': paths['glove-life-vertical-down']['commands']}) + ';\n'
        + 'export const SB2_GLOVE_PATH_ADDRESSES = '
        + json.dumps({'left': paths['glove-repress']['address'],
                      'right': paths['glove-right-release']['address'],
                      'up': paths['glove-life-vertical-up']['address'],
                      'down': paths['glove-life-vertical-down']['address']}) + ' as const;\n', encoding='utf-8')
    print({name: {'address': hex(path['address']), 'commands': len(path['commands'])}
           for name, path in paths.items()})


if __name__ == '__main__':
    extract(sys.argv[1])
