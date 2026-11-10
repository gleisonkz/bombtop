"""Ponte de pesquisa: Snes9x/libretro, sem alterações na ROM ou RAM."""
import base64
import ctypes as C
import hashlib
import io
import json
import os
import sys
from pathlib import Path
from PIL import Image


class Game(C.Structure):
    _fields_ = [('path', C.c_char_p), ('data', C.c_void_p),
                ('size', C.c_size_t), ('meta', C.c_char_p)]


class System(C.Structure):
    _fields_ = [('name', C.c_char_p), ('version', C.c_char_p),
                ('extensions', C.c_char_p), ('fullpath', C.c_bool),
                ('block_extract', C.c_bool)]


class Geometry(C.Structure):
    _fields_ = [('base_width', C.c_uint), ('base_height', C.c_uint),
                ('max_width', C.c_uint), ('max_height', C.c_uint),
                ('aspect_ratio', C.c_float)]


class Timing(C.Structure):
    _fields_ = [('fps', C.c_double), ('sample_rate', C.c_double)]


class AvInfo(C.Structure):
    _fields_ = [('geometry', Geometry), ('timing', Timing)]


class Emulator:
    buttons = dict(zip(('B', 'Y', 'SELECT', 'START', 'UP', 'DOWN', 'LEFT',
                        'RIGHT', 'A', 'X', 'L', 'R'), range(12)))

    def __init__(self, core):
        self.core_path = Path(core)
        self.dll = C.CDLL(str(self.core_path))
        self.held = {0: set(), 1: set()}
        self.frame = 0
        self.image = None
        self.pixel_format = 0
        self.loaded = False
        self.rom_hash = None
        self.native_timing = None
        self.callbacks = []

        def env(cmd, data):
            if cmd == 10:  # SET_PIXEL_FORMAT
                fmt = C.cast(data, C.POINTER(C.c_int))[0]
                if fmt not in (0, 1, 2):
                    return False
                self.pixel_format = fmt
                return True
            if cmd == 3:  # GET_CAN_DUPE
                C.cast(data, C.POINTER(C.c_bool))[0] = True
                return True
            if cmd == 15:  # GET_VARIABLE: opções padrão do núcleo
                return False
            if cmd == 17:  # GET_VARIABLE_UPDATE
                C.cast(data, C.POINTER(C.c_bool))[0] = False
                return True
            return False

        def video(data, width, height, pitch):
            if not data:
                return
            raw = C.string_at(data, pitch * height)
            mode = {0: 'BGR;15', 1: 'BGRX', 2: 'BGR;16'}[self.pixel_format]
            self.image = Image.frombytes('RGB', (width, height), raw, 'raw', mode, pitch, 1)

        signatures = [
            ('environment', C.CFUNCTYPE(C.c_bool, C.c_uint, C.c_void_p), env),
            ('video_refresh', C.CFUNCTYPE(None, C.c_void_p, C.c_uint, C.c_uint, C.c_size_t), video),
            ('audio_sample', C.CFUNCTYPE(None, C.c_int16, C.c_int16), lambda l, r: None),
            ('audio_sample_batch', C.CFUNCTYPE(C.c_size_t, C.c_void_p, C.c_size_t), lambda p, n: n),
            ('input_poll', C.CFUNCTYPE(None), lambda: None),
            ('input_state', C.CFUNCTYPE(C.c_int16, C.c_uint, C.c_uint, C.c_uint, C.c_uint),
             lambda port, device, index, button: int(device == 1 and index == 0 and button in self.held.get(port, ()))),
        ]
        for name, signature, function in signatures:
            callback = signature(function)
            self.callbacks.append(callback)
            setter = getattr(self.dll, 'retro_set_' + name)
            setter.argtypes = [signature]
            setter(callback)
        self.dll.retro_load_game.argtypes = [C.POINTER(Game)]
        self.dll.retro_load_game.restype = C.c_bool
        self.dll.retro_get_memory_data.argtypes = [C.c_uint]
        self.dll.retro_get_memory_data.restype = C.c_void_p
        self.dll.retro_get_memory_size.argtypes = [C.c_uint]
        self.dll.retro_get_memory_size.restype = C.c_size_t
        self.dll.retro_serialize_size.restype = C.c_size_t
        self.dll.retro_serialize.argtypes = [C.c_void_p, C.c_size_t]
        self.dll.retro_serialize.restype = C.c_bool
        self.dll.retro_unserialize.argtypes = [C.c_void_p, C.c_size_t]
        self.dll.retro_unserialize.restype = C.c_bool
        self.dll.retro_get_system_av_info.argtypes = [C.POINTER(AvInfo)]
        self.dll.retro_get_system_av_info.restype = None
        self.dll.retro_get_region.restype = C.c_uint
        self.dll.retro_init()
        info = System()
        self.dll.retro_get_system_info(C.byref(info))
        self.identity = {'name': info.name.decode(), 'version': info.version.decode(),
                         'core_sha256': hashlib.sha256(self.core_path.read_bytes()).hexdigest()}

    def run(self, name, args):
        if name == 'load_rom':
            path = Path(args['path']).resolve(strict=True)
            if self.loaded:
                self.dll.retro_unload_game()
            data = path.read_bytes()
            self.rom = C.create_string_buffer(data)
            self.game = Game(str(path).encode(), C.cast(self.rom, C.c_void_p), len(data), None)
            self.loaded = bool(self.dll.retro_load_game(C.byref(self.game)))
            if not self.loaded:
                raise ValueError('Snes9x rejeitou a ROM')
            av_info = AvInfo()
            self.dll.retro_get_system_av_info(C.byref(av_info))
            self.native_timing = {
                'region': 'PAL' if self.dll.retro_get_region() == 1 else 'NTSC',
                'frames_per_second': av_info.timing.fps,
                'audio_sample_rate': av_info.timing.sample_rate,
            }
            self.dll.retro_set_controller_port_device.argtypes = [C.c_uint, C.c_uint]
            self.dll.retro_set_controller_port_device(0, 1)
            self.dll.retro_set_controller_port_device(1, 1)
            self.rom_hash = hashlib.sha256(data).hexdigest()
            for held in self.held.values():
                held.clear()
            self.frame = 0
            self.image = None
        elif name == 'advance':
            if not self.loaded:
                raise ValueError('Carregue uma ROM primeiro')
            frames = args.get('frames', 1)
            if not isinstance(frames, int) or not 1 <= frames <= 36000:
                raise ValueError('frames deve estar entre 1 e 36000')
            self.held = {0: {self.buttons[b.upper()] for b in args.get('buttons', [])},
                         1: {self.buttons[b.upper()] for b in args.get('buttons2', [])}}
            try:
                for _ in range(frames):
                    self.dll.retro_run()
                    self.frame += 1
            finally:
                for held in self.held.values():
                    held.clear()
        elif name == 'read_ram':
            offset, length = args.get('offset', 0), args.get('length', 131072)
            size = self.dll.retro_get_memory_size(2)  # SYSTEM_RAM
            if not self.loaded or offset < 0 or length < 1 or offset + length > size:
                raise ValueError('Intervalo de WRAM inválido')
            data = C.string_at(self.dll.retro_get_memory_data(2) + offset, length)
            return {**self.status(), 'offset': offset, 'hex': data.hex()}
        elif name in ('save_state', 'load_state'):
            if not self.loaded:
                raise ValueError('Carregue uma ROM primeiro')
            path = Path(args['path']).resolve()
            if name == 'save_state':
                data = C.create_string_buffer(self.dll.retro_serialize_size())
                if not self.dll.retro_serialize(data, len(data)):
                    raise ValueError('Falha ao serializar')
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open('xb') as stream:
                    stream.write(data.raw)
                path.with_suffix(path.suffix + '.json').write_text(json.dumps(self.status()))
            else:
                metadata = json.loads(path.with_suffix(path.suffix + '.json').read_text())
                if metadata['rom_sha256'] != self.rom_hash or metadata['core_sha256'] != self.identity['core_sha256']:
                    raise ValueError('Estado pertence a outra ROM ou núcleo')
                raw = path.read_bytes()
                data = C.create_string_buffer(raw)
                if not self.dll.retro_unserialize(data, len(raw)):
                    raise ValueError('Falha ao restaurar')
                self.frame = metadata['frame']
                self.image = None  # a próxima execução produzirá a tela correta
        elif name not in ('status', 'get_screen'):
            raise ValueError('Operação desconhecida')
        result = self.status()
        if args.get('screenshot', name == 'get_screen') and self.image:
            output = io.BytesIO()
            self.image.save(output, format='PNG')
            result['png'] = base64.b64encode(output.getvalue()).decode()
        return result

    def status(self):
        return {**self.identity, 'host_pid': os.getpid(), 'loaded': self.loaded,
                'frame': self.frame, 'rom_sha256': self.rom_hash,
                'native_timing': self.native_timing}


if __name__ == '__main__':
    emulator = Emulator(sys.argv[1])
    try:
        for line in sys.stdin:
            try:
                request = json.loads(line)
                response = {'result': emulator.run(request['name'], request.get('arguments', {}))}
            except Exception as error:
                response = {'error': str(error)}
            print(json.dumps(response), flush=True)
    finally:
        if emulator.loaded:
            emulator.dll.retro_unload_game()
        emulator.dll.retro_deinit()
