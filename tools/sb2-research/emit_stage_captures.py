"""Gera dados compartilhados a partir de duas capturas MCP, sem inventar pisos."""
import json
import sys
from pathlib import Path
from extract_grids import extract


def emit(standard, hidden, destination):
    captures = extract(standard)['arenas'] + extract(hidden)['arenas']
    captures.sort(key=lambda capture: capture['selected_arena_number'])
    if [capture['selected_arena_number'] for capture in captures] != list(range(1, 13)):
        raise ValueError('São necessárias exatamente as arenas 1 a 12')
    for key in ('core_sha256', 'rom_sha256'):
        if len({capture[key] for capture in captures}) != 1:
            raise ValueError(f'Capturas de origens diferentes: {key}')
    output = ['/**',
              ' * Grades lidas pelo MCP de Snes9x e confrontadas com REA/Frida.',
              ' * Capturas individuais, não uma afirmação sobre PRNG ou mecânicas.',
              ' * Códigos especiais são preservados sem conversão em pisos genéricos.',
              ' * Gerado por tools/sb2-research/emit_stage_captures.py.',
              ' */',
              'export type Sb2ArenaNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;',
              'export interface Sb2StageCapture {',
              '  readonly number: Sb2ArenaNumber;',
              '  readonly frame: number;',
              '  readonly current: readonly (readonly number[])[];',
              '  readonly background: readonly (readonly number[])[];',
              '}',
              'export const SB2_CAPTURE_SIZE = { width: 15, height: 13 } as const;',
              f'export const SB2_CAPTURE_ROM_SHA256 = "{captures[0]["rom_sha256"]}";',
              f'export const SB2_CAPTURE_CORE_SHA256 = "{captures[0]["core_sha256"]}";',
              'export const SB2_STAGE_CAPTURES = [']
    for capture in captures:
        output.extend(['  {', f'    number: {capture["selected_arena_number"]},',
                       f'    frame: {capture["frame"]},'])
        for name in ('current', 'background'):
            output.append(f'    {name}: [')
            output.extend('      [' + ', '.join(str(value) for value in row) + '],'
                          for row in capture['grids'][name])
            output.append('    ],')
        output.append('  },')
    output.extend(['] as const satisfies readonly Sb2StageCapture[];', ''])
    with Path(destination).open('x', encoding='utf-8') as stream:
        stream.write('\n'.join(output))


if __name__ == '__main__':
    emit(*sys.argv[1:])
