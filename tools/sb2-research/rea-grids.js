// Observação pelo REA/Frida. Não escreve na ROM nem na WRAM.
const core = Process.getModuleByName('snes9x_libretro.dll');
const memoryEntry = core.getExportByName('retro_get_memory_data');
let samples = 0;
send({ kind: 'identity', module: core.path, base: core.base.toString(),
  architecture: Process.arch, memory_entry: memoryEntry.toString() });
Interceptor.attach(memoryEntry, {
  onEnter(args) { this.systemRam = args[0].toInt32() === 2; },
  onLeave(result) {
    if (!this.systemRam || result.isNull() || samples >= 20) return;
    const grids = {};
    for (const [name, base] of [['current', 0x1c182], ['background', 0x1d182]]) {
      grids[name] = Array.from({ length: 13 }, (_, y) =>
        Array.from({ length: 15 }, (_, x) => result.add(base + y * 128 + x * 2).readU16()));
    }
    send({ kind: 'wram-grids', sample: ++samples, wram_pointer: result.toString(),
      selection_byte_1ccd: result.add(0x1ccd).readU8(), grids });
  },
});
