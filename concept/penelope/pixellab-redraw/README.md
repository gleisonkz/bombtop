# Penélope — opção 3 aprovada

Aparência única: `../pixellab-preview/base-3.png`. Novo personagem PixelLab `68cdddb6-4886-43ff-b1fc-600d04fdf137`. As vistas são derivadas dessa imagem; a Penélope antiga fornece somente coordenadas de poses, nunca aparência.

## Contrato das folhas

| Folha | Grade | Células ocupadas | Quadro nativo | PNG final |
|---|---|---:|---|---|
| Jogo | 9 colunas × 17 linhas | 98 | 192×192 | `penelope-candidate.png`, 1728×3264 |
| Apresentação | 16 colunas × 1 linha | 16 | 192×192 | `penelope-lobby-candidate.png`, 3072×192 |
| Vitória | 16 colunas × 1 linha | 16 | 192×192 | `penelope-victory-candidate.png`, 3072×192 |

São 130 células mapeadas a 111 imagens-fonte únicas. As 19 repetições exatas da folha antiga são sustentação/tempo da animação, não poses novas. As 55 células excedentes do jogo permanecem transparentes.

`pose-map.json`, `source-inventory.json` e `poses/` registram as referências antigas extraídas sem retoque. `skeletons/` contém as estimativas COCO-18 do endpoint oficial PixelLab `POST /v2/estimate-skeleton`. `reference/` contém as vistas novas. O PNG aprovado de 128×160 foi apenas centralizado com margem transparente (32,16) numa tela de 192×192, sem redimensionamento.

`prepare-requests.py` calcula deslocamentos de articulações em relação à pose neutra antiga e os aplica ao rig neutro aprovado. A cabeça mantém os deslocamentos internos da referência nova em relação ao pescoço; somente dano/queda admitem a inclinação da pose original. Nas costas, olhos e nariz ficam atrás da cabeça no mapa de profundidade. Esse script altera somente coordenadas enviadas ao gerador, nunca pixels de rosto, cabelo, capacete ou membros.

`requests.json` registra os pedidos de 21 clipes; `jobs.json` registra os IDs. Cada imagem em `raw/` é um PNG gerado pelo PixelLab a partir da referência visual real. Sem corações, brilhos, pó, partículas, aura, sombras de chão, bandeira, espelho ou outros objetos nas mãos. Os gestos das folhas extras são preservados com as mãos vazias.

As revisões selecionadas ficam em `north-retry/` e `north-no-fx/`: a primeira corrige a convenção esquerda/direita de articulações que o estimador havia invertido nas costas; a segunda descreve a ação do especial somente como movimento físico da mão, evitando que o modelo incorpore corações ao interpretar a palavra “beijo”. O mapa principal de jobs escolhe os PNGs finais, e os hashes dos arquivos selecionados são preservados no manifesto de fontes.

## Coleta e empacotamento

```powershell
& concept/lantern/restart-skeleton/collect.ps1 -AssetRoot concept/penelope/pixellab-redraw
& concept/penelope/pixellab-redraw/pack.ps1
& concept/penelope/pixellab-redraw/verify.ps1
```

A coleta apenas baixa jobs existentes. O empacotador coloca os PNGs nativos inteiros na grade, sem escala, recorte, harmonização de paleta ou edição de feições. `sources.json` registra os hashes; `report.json` registra dimensões, alfa, limites e repetições efetivas.

As três folhas foram aprovadas pelo usuário e integradas tanto no worktree desta conversa quanto na cópia efetivamente servida na porta 5173 (`D:/Programação/Jogos/New folder/bombtop`). Os três PNGs ativos são cópias exatas dos candidatos aprovados, com URLs versionadas por hash para evitar cache antigo. Os perfis dos outros personagens foram preservados.

`runtime-metadata.json` registra âncora (97;158), corpo de 124 px, escala 0,17306452, retrato [58,31,69,72], origem do especial, limites e overrides de apresentação/vitória. `palms.json` registra 50 pontos em 30 quadros de transporte. O finalizador apenas mede a arte e copia os PNGs inteiros; não altera seus pixels.

```powershell
python -B apps/client/scripts/finalize-penelope-pixellab.py --promote
python -B apps/client/scripts/build-carry-anchors.py --character penelope
```

A opção `--target` do finalizador permite promover para o destino de execução explicitamente solicitado. A integração foi validada por hashes HTTP das três imagens na porta 5173, 145 testes focados no worktree, 135 na cópia em execução, typecheck e build, além da reprodução dos encaixes e dos testes de retrato.

## Entrega verificada

As três folhas finais passaram na conferência de 130 células, 111 PNGs nativos selecionados, 55 células vazias e igualdade de pixels/alfa entre cada fonte e seu lugar na grade. Os arquivos nativos e as folhas permanecem sem efeitos; os rótulos aparecem apenas nos painéis de revisão.

`walk-preview.gif` mostra caminhada de frente, perfil e costas. `lobby-preview.gif` e `victory-preview.gif` mostram as duas sequências extras. `north-review.png`, `face-review.png`, `kiss-review.png` e `extras-review.png` documentam a revisão das poses, da orientação e da ausência de efeitos.
