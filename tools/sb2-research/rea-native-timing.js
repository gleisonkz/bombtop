// Observação da ABI libretro x64 usada pelo host; sem escrita de memória.
const core = Process.getModuleByName('snes9x_libretro.dll');
send({ kind: 'timing-identity', architecture: Process.arch, module: core.path });
Interceptor.attach(core.getExportByName('retro_get_system_av_info'), {
  onEnter(args) { this.info = args[0]; },
  onLeave() {
    send({ kind: 'native-av-info', geometry: {
      base_width: this.info.readU32(), base_height: this.info.add(4).readU32(),
      max_width: this.info.add(8).readU32(), max_height: this.info.add(12).readU32(),
      aspect_ratio: this.info.add(16).readFloat(),
    }, frames_per_second: this.info.add(24).readDouble(),
    audio_sample_rate: this.info.add(32).readDouble() });
  },
});
Interceptor.attach(core.getExportByName('retro_get_region'), {
  onLeave(result) { send({ kind: 'native-region', value: result.toUInt32() }); },
});
