"""Extrai contador e semente MCP associados a leituras de pisos verificadas."""
import hashlib
import json
import struct
import sys
from pathlib import Path

journal_path = Path(sys.argv[1])
rows = json.loads(journal_path.read_text(encoding='utf-8'))
comparison = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
verified = {sample['label']: sample for sample in comparison['samples']}
samples = {}
for row in rows:
    if row['name'] != 'read_ram' or row['label'] not in verified:
        continue
    response = json.loads(row['content'][0]['text'])
    ram = bytes.fromhex(response['hex'])
    if response['offset'] != 0 or len(ram) != 131072 or response['frame'] != verified[row['label']]['frame']:
        raise ValueError('Captura completa verificada não encontrada')
    samples[row['label']] = {'frame': response['frame'], 'phase': struct.unpack_from('<H', ram, 0x32)[0],
                             'seed': struct.unpack_from('<H', ram, 0xd6)[0], 'word': struct.unpack_from('<H', ram, 0x400)[0]}
report = {'journal': sys.argv[1], 'journal_sha256': hashlib.sha256(journal_path.read_bytes()).hexdigest(),
          'evidence_id': comparison['evidence_id'], 'script_id': comparison['script_id'], 'samples': samples,
          'limitations': ['A semente e o contador vêm do MCP; a palavra 0x400 foi observada também pelo REA.',
                         'A reprodução do RNG entre amostras é uma verificação separada da extração.']}
with Path(sys.argv[3]).open('x', encoding='utf-8') as stream:
    json.dump(report, stream, indent=2)
    stream.write('\n')
print({'samples': len(samples)})
