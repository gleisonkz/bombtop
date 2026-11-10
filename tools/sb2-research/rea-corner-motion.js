// Observa estruturas nativas de jogadores durante leituras MCP; não altera WRAM.
const core = Process.getModuleByName('snes9x_libretro.dll');
let samples = 0;
send({ kind: 'motion-identity', module: core.path, architecture: Process.arch });
Interceptor.attach(core.getExportByName('retro_get_memory_data'), {
  onEnter(args) { this.systemRam = args[0].toInt32() === 2; },
  onLeave(result) {
    if (!this.systemRam || result.isNull() || samples >= 640) return;
    const players = Array.from({ length: 4 }, (_, seat) => {
      const base = result.add(0x8000 + seat * 0x100);
      return { seat, x: base.add(0x10).readU16(), y: base.add(0x18).readU16(),
        raw_hex: Array.from(new Uint8Array(base.readByteArray(256)), byte => byte.toString(16).padStart(2, '0')).join('') };
    });
    send({ kind: 'native-players', sample: ++samples,
      selection_byte_1ccd: result.add(0x1ccd).readU8(), players });
  },
});
