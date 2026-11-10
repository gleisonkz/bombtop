// Ciclo dos pisos numerados e jogadores; somente observação da WRAM.
const core = Process.getModuleByName('snes9x_libretro.dll');
let samples = 0;
send({ kind: 'effects-identity', module: core.path, architecture: Process.arch });
Interceptor.attach(core.getExportByName('retro_get_memory_data'), {
  onEnter(args) { this.systemRam = args[0].toInt32() === 2; },
  onLeave(result) {
    if (!this.systemRam || result.isNull() || samples >= 600) return;
    const grids = {};
    for (const [name, offset] of [['current', 0x1c182], ['background', 0x1d182]]) {
      grids[name] = Array.from({ length: 13 }, (_, y) =>
        Array.from({ length: 15 }, (_, x) => result.add(offset + y * 128 + x * 2).readU16()));
    }
    const players = Array.from({ length: 4 }, (_, seat) => {
      const base = result.add(0x8000 + seat * 0x100);
      return { seat, raw_hex: Array.from(new Uint8Array(base.readByteArray(256)),
        byte => byte.toString(16).padStart(2, '0')).join('') };
    });
    send({ kind: 'arena-effects', sample: ++samples,
      selection_byte_1ccd: result.add(0x1ccd).readU8(), grids, players });
  },
});

