# Verificação — 26/10/2026

Raiz: `D:/Programação/Jogos/New folder/bombtop`.

- 107 poses, 18 linhas, 9 colunas, RGBA, células 192 × 192: aprovado.
- Primeiro idle: pixels idênticos à opção 4 aprovada, com padding (32,16).
- Revisão visual independente: aceita; observações menores em `qa/visual-acceptance.md`.
- 50 centros de palmas em 30 poses; sockets reprodutíveis sem flags.
- 220 testes Vitest focados passaram em 10 arquivos.
- 5 testes da arte histórica, 2 de retratos e 7 de carry passaram.
- Typecheck e build do cliente passaram. Build mantém aviso de chunk >500 kB.
- `git diff --check` sem erros nos arquivos tocados.

Bridge verificou `http://localhost:5173/personagens`, Pelé selecionado,
CSS com células 192 × 192, atlas 1728 × 3456 e versão
`20261026-lula-option4-v1`. O SHA-256 servido pelo navegador e o arquivo
local são idênticos:

`f9f52942e2d433439eaa815772fdf0d8f7f87009713885cc55d476cdcb0d34ac`

A captura de elemento do Bridge retornou um recorte desalinhado, portanto
não foi usada como evidência visual. A inspeção visual usa os frames reais,
as folhas de contato e a prévia; a confirmação da porta 5173 usa DOM, CSS,
versão do código e hash do PNG servido.
