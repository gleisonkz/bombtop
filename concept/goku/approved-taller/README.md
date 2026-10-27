# Goku aprovado mais alto

Base aprovada pelo usuário; 108 poses de jogo e transformação de menu com oito poses e retorno explícito em 16 frames. Sem poderes, objetos ou partículas embutidos.

A grade foi ampliada para 146×192, apoio (71.5,186), para acomodar braços levantados preservando o tamanho corporal. A escala é única (140/104); não há normalização individual de frames. Cabeça e mãos vazias nas poses de transporte usam um recorte registrado da base limpa; tronco e pernas mantêm os desenhos animados.

`manifest.json` seleciona as fontes; `reskin-jobs.json` registra as gerações. `carry-fx-*` e `carry-rig-*` registram as decisões exatas de limpeza e montagem no PixelLab. Os outputs originais ficam arquivados, inclusive os rejeitados com efeitos.

Reproduzir: `python apps/client/scripts/pack-goku-approved.py --write`. Verificar: `python apps/client/scripts/test-goku-approved.py`. Promovido somente no workspace atual.
