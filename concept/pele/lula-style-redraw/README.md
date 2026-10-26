# Pelé — opção 4, estilo do Lula

Referência aprovada: `../lula-style-preview/option-4.png`, 128 × 160 RGBA.
A opção 4 foi escolhida pelo usuário em 26/10/2026. As animações foram
redesenhadas pelo MCP PixelLab com os pixels reais da referência e das rotações.
Os IDs de geração e os totais de origem estão em `jobs.json`.

## Contrato

- Atlas: 1728 × 3456 RGBA, 9 colunas e 18 linhas de células 192 × 192.
- 107 poses ocupadas; caudas das linhas transparentes.
- Origens 128 × 160 sem redimensionamento; posição na célula: (32, 16).
- Âncora (96, 156), corpo 119 px, escala de exibição 0.1815126.
- Idle frente/lado/costas: 4 cada; caminhada: 6 cada; tonto: 6; derrota: 7.
- Chute frente/lado/costas: 9 cada, lançamento do jogo na coluna 5.
- Transporte parado: 4 cada; andando: 6 cada; comemoração: 7.
- O lado esquerdo usa o espelhamento já existente no jogo.
- Sem bola ou bomba desenhada: ambos continuam pertencendo ao renderizador.

O frame inicial de idle preserva exatamente a referência aprovada. Os clips
idle usam os primeiros quatro frames da sequência de cinco; as caminhadas e
o tonto descartam o frame inicial e usam os seis frames gerados. Derrota,
chute e comemoração incluem a pose inicial. Não há poses repetidas para
simular uma nova animação. `manifest.json` registra arquivos, hashes e limites.

Os primeiros chutes de frente e costas continham bolas e foram rejeitados:
`d4bb690e-c453-46bd-9d99-08cfe6be934f` e
`24fb6efe-831d-49b5-95f0-6d214e00a8ad`. Os arquivos de origem foram preservados
nas pastas `generated/*-rejected-ball`, fora do atlas.

## Reprodução

Na raiz do repositório:

```powershell
python concept/pele/lula-style-redraw/pack.py
python apps/client/scripts/test-pele-option4.py
python concept/pele/lula-style-redraw/measure-palms.py
python concept/pele/lula-style-redraw/preview.py
```

`sheet-review.png` mostra as células; `palm-review.png` mostra os pontos de
apoio e `pele-preview.gif` reproduz as poses embaladas com o timing do jogo.
`integrate.py` instala somente os recursos e metadados do Pelé, com proteção
contra substituição concorrente. A imagem anterior fica em `before-integration`.
O empacotador histórico `apps/client/scripts/pack-pele.py` agora produz somente
`../packed-supplied-final.png`, para não sobrescrever esta versão.
