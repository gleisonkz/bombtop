# Verificação final — 26/10/2026

Raiz autoritativa: `D:/Programação/Jogos/New folder/bombtop`.

- 108 poses, 18 linhas, 9 colunas, RGBA 1728 × 3456, células 192 × 192:
  validador aprovado no candidato e no arquivo de produção.
- Primeiro idle preserva exatamente a opção 1 aprovada, com padding (32,16).
- Todas as ações revisadas nos frames reais; costas sem rosto/estrela frontal,
  mãos vazias, sem objetos ou efeitos indevidos, sem anatomia cortada.
- 30 poses de transporte e 50 centros de palmas aceitos por revisão independente;
  ocupação mínima de pele 13/25 na vizinhança de cada ponto.
- Proteção de rosto revisada em todas as 108 células, vinculada por hash ao atlas.
- 223 testes Vitest passaram em 12 arquivos, incluindo cores de face/camisa,
  atlas, especiais, transporte, menu, retrato, introdução e altura da cabeça.
- 2 testes Python de retratos passaram. Âncoras do Lula passam no check direcionado.
- Typecheck e build passaram; permanece o aviso existente de chunk >500 kB.
- `git diff --check` sem erros nos arquivos da alteração.

O teste Python global de âncoras teve 5 acertos e 2 falhas fora do Lula:
sementes antigas de Naruto divergem das coordenadas registradas e o perfil
de Pelé difere da saída do gerador. A comparação com o gerador de `HEAD`,
sem as alterações deste trabalho, reproduziu as mesmas divergências.
Esses perfis foram preservados; a troca do Lula não os reescreve.

## Porta 5173

Bridge navegou a `http://localhost:5173/personagens`, selecionou Lula e
confirmou a versão `20261026-pele-style-option1-v1`, células 192 × 192,
proteção de cores e novas sequências nos estilos do DOM.
Uma captura de viewport mostrou o novo Lula no card, na comemoração e na
prévia da arena. O PNG servido pelo navegador tem o mesmo SHA-256 do arquivo
local e das regiões de proteção:

`b67408b8d9df0a689dec7dc1d3a55f0561254afef4cae90b980e0c79d2c2d589`

Prévia: `lula-preview.gif`; fonte aprovada: `../pele-style-preview/option-1.png`.
Arquivo anterior preservado em `before-integration/lula.png`.
