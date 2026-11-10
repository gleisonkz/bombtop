// Observa pisos, jogadores e região candidata das bombas; não escreve na WRAM.
const core = Process.getModuleByName('snes9x_libretro.dll');
let samples = 0;
send({ kind: 'conveyor-identity', module: core.path, architecture: Process.arch });
Interceptor.attach(core.getExportByName('retro_get_memory_data'), {
  onEnter(args) { this.systemRam = args[0].toInt32() === 2; },
  onLeave(result) {
    if (!this.systemRam || result.isNull() || samples >= 200) return;
    const hex = (offset, length) => Array.from(new Uint8Array(result.add(offset).readByteArray(length)),
      value => value.toString(16).padStart(2, '0')).join('');
    const grids = {};
    for (const [name, offset] of [['current', 0x1c182], ['background', 0x1d182]]) {
      grids[name] = Array.from({ length: 13 }, (_, y) =>
        Array.from({ length: 15 }, (_, x) => result.add(offset + y * 128 + x * 2).readU16()));
    }
    send({ kind: 'conveyor-oam-observation', sample: ++samples,
      selection_byte_1ccd: result.add(0x1ccd).readU8(), grids,
      players: Array.from({ length: 4 }, (_, seat) => ({ seat, raw_hex: hex(0x8000 + seat * 256, 256) })),
      oam_bomb_region_offset: 0x2340, oam_bomb_region_hex: hex(0x2340, 4),
      control_region_offset: 0x5c00, control_region_hex: hex(0x5c00, 1024),
      candidate_bomb_region_offset: 0x12000, candidate_bomb_region_hex: hex(0x12000, 256) });
  },
});
