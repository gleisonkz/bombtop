"""Confronta a resposta libretro observada pelo REA com os metadados MCP."""
import json
import sys
from pathlib import Path


def verify(bundle_path, journal_path, evidence_id):
    bundle = json.loads(Path(bundle_path).read_text(encoding='utf-8'))
    record = next(value for value in bundle['records'] if value['evidence_id'] == evidence_id)
    result = record['normalized_result']
    if result['messages_truncated']:
        raise ValueError('Mensagens REA truncadas')
    payloads = [message['payload'] for message in result['messages'] if message.get('type') == 'send']
    av = [value for value in payloads if value.get('kind') == 'native-av-info']
    regions = [value['value'] for value in payloads if value.get('kind') == 'native-region']
    if not av or not regions or any(value != 1 for value in regions):
        raise ValueError('Cobertura PAL inesperada')
    if any(value['frames_per_second'] != av[0]['frames_per_second']
           or value['audio_sample_rate'] != av[0]['audio_sample_rate'] for value in av):
        raise ValueError('O núcleo mudou a taxa durante a captura')
    journal = json.loads(Path(journal_path).read_text(encoding='utf-8'))
    statuses = [json.loads(row['content'][0]['text']) for row in journal]
    for status in statuses:
        timing = status['native_timing']
        if timing['region'] != 'PAL' or timing['frames_per_second'] != av[0]['frames_per_second']:
            raise ValueError('Relógio MCP/REA divergente')
        if timing['audio_sample_rate'] != av[0]['audio_sample_rate']:
            raise ValueError('Taxa de áudio divergente')
    return {'status': 'matched', 'evidence_id': evidence_id,
            'rom_sha256': statuses[0]['rom_sha256'], 'core_sha256': statuses[0]['core_sha256'],
            'frames_per_second': av[0]['frames_per_second'], 'audio_sample_rate': av[0]['audio_sample_rate'],
            'region': 'PAL', 'region_observations': len(regions),
            'av_info_observations': len(av), 'metadata_observations': len(statuses),
            'limitations': ['Taxa declarada pelo núcleo, não medição do relógio de parede.',
                            'Não valida sincronização de áudio, input ou renderização do Bombtop.']}


if __name__ == '__main__':
    report = verify(*sys.argv[1:4])
    with Path(sys.argv[4]).open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
    print(report)
