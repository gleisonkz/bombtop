"""Le arrays de capturas sem manter o journal inteiro na memoria."""
import json
from pathlib import Path


def iter_capture_records(path, chunk_size=65536):
    decoder = json.JSONDecoder()
    with Path(path).open(encoding='utf-8') as stream:
        buffer = ''

        def token():
            nonlocal buffer
            while not buffer.strip():
                more = stream.read(chunk_size)
                if not more:
                    raise ValueError('Journal JSON incompleto')
                buffer += more
            buffer = buffer.lstrip()
            return buffer[0]

        if token() != '[':
            raise ValueError('Journal deve ser um array JSON')
        buffer = buffer[1:]
        first = True
        while True:
            if token() == ']':
                buffer = buffer[1:]
                break
            if not first:
                if token() != ',':
                    raise ValueError('Separador JSON ausente')
                buffer = buffer[1:]
                if token() == ']':
                    raise ValueError('Virgula final no journal')
            first = False
            while True:
                try:
                    record, end = decoder.raw_decode(buffer)
                    break
                except json.JSONDecodeError:
                    more = stream.read(chunk_size)
                    if not more:
                        raise ValueError('Registro JSON incompleto ou invalido')
                    buffer += more
            buffer = buffer[end:]
            if not isinstance(record, dict):
                raise ValueError('Registro de captura deve ser um objeto JSON')
            yield record
        while True:
            if buffer.strip():
                raise ValueError('Conteudo apos o array JSON')
            buffer = stream.read(chunk_size)
            if not buffer:
                break
