// Observa mudanças da bolsa entre entradas/saídas de retro_run, sem escrever RAM.
const core = Process.getModuleByName('snes9x_libretro.dll');
const ram = new NativeFunction(core.getExportByName('retro_get_memory_data'), 'pointer', ['uint'])(2);
let events = 0;
const bag = () => Array.from({ length: 65 }, (_, i) => ram.add(0x3c48 + i * 2).readU16());
send({ kind: 'bag-init-identity', architecture: Process.arch, module: core.path });
Interceptor.attach(core.getExportByName('retro_run'), {
  onEnter() {
    if (events >= 40) return;
    this.before = bag(); this.seed = ram.add(0xd6).readU16(); this.phase = ram.add(0x32).readU16();
  },
  onLeave() {
    if (!this.before) return;
    const after = bag();
    if (after.every((value, i) => value === this.before[i])) return;
    send({ kind: 'bag-transition', event: ++events, arena: ram.add(0x1ccd).readU8() + 1,
      seed_before: this.seed, seed_after: ram.add(0xd6).readU16(),
      phase_before: this.phase, phase_after: ram.add(0x32).readU16(),
      bag_before: this.before, bag_after: after });
  },
});
