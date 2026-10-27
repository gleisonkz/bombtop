# Lanterna A1 — reinício por esqueleto

Novo cadastro PixelLab: `e209a97e-98a4-4f0d-9152-37abfc8587cb`.

A única referência de aparência é o A1 aprovado, `concept/lantern/pixellab-preview/bald-1.png`. `create_character(mode="v3", n_directions=4)` gerou as vistas a partir desse PNG. Não havia um personagem Lanterna antigo na lista remota para apagar: as tentativas rejeitadas eram jobs de imagens avulsas. Elas não participam deste processo.

A folha atual do jogo fornece apenas as posições. O endpoint oficial `POST https://api.pixellab.ai/v2/estimate-skeleton` extraiu 18 articulações COCO de cada uma das 84 poses únicas. Os resultados estão em `skeletons/`. Nenhum PNG da folha antiga foi enviado ao gerador de animação; somente as coordenadas das articulações, incluindo os pontos de cabeça/olhos para orientação. Não houve clonagem de olhos, sobrancelhas ou rosto por script.

Cada sequência foi gerada por `animate_with_skeleton_v3` usando a imagem-base A1 da direção correspondente. `first_frame_keypoints` descreve a pose real dessa referência; `keypoints` descreve as poses extraídas do jogo. A ordem de desenho fracionária do estimador foi multiplicada por dois para obter inteiros. As bases e PNGs nativos permanecem em `reference/` e `raw/`. `jobs.json` registra as 18 sequências. Na tentativa adicional de queda, somente a profundidade e ordem de desenho dos pontos das pernas foram alteradas no pedido ao gerador para torná-las visíveis; o desenho continua sendo feito pelo PixelLab.

## Folha

- PNGs nativos novos: **128 × 160**, transparentes.
- Grade de entrega: **9 × 18**, células **132 × 164**, folha **1188 × 2952**.
- Cada PNG nativo recebe apenas uma borda transparente de 2 px, sem redimensionamento.
- **84 poses novas** distribuídas nas **108 células** originais; 54 células excedentes vazias.
- As repetições/holds do mapa original são preservadas; não são anunciadas como poses novas.
- Sem efeitos, bolhas, esferas, luzes, sombras de chão ou objetos nas mãos.

`collect.ps1` somente baixa os PNGs retornados; não inicia novas gerações. `pack.ps1` somente monta a grade com os PNGs inteiros. `sources.json` registra seus hashes. Nenhum desses scripts corrige feições, paleta ou membros.

```powershell
& concept/lantern/restart-skeleton/collect.ps1
& concept/lantern/restart-skeleton/pack.ps1
```

`candidate.png` é a nova folha completa; `walk-preview.gif` mostra frente, perfil e costas; `face-preview.png` reúne amostras ampliadas. `death-preview.gif` mostra a queda, com os três quadros finais regenerados a partir da vista lateral e tornozelos corrigidos no esqueleto. O mapa de jobs seleciona explicitamente esses quadros; as tentativas não escolhidas ficam preservadas para rastreio.

A versão final, incluindo as correções de orelhas, transporte e orientação de costas, foi aprovada pelo usuário e integrada ao jogo. `apps/client/public/sprites/lantern.png` é uma cópia exata do candidato aprovado. Nenhum pixel foi retocado durante a integração.

`runtime-metadata.json` registra âncora (67,5;154), corpo de 142 px, escala 0,15316901, retrato [39,12,57,75], altura de apresentação 136 e limites horizontais [7,111]. `native-palms.json` registra 50 pontos em 30 quadros de transporte. `paint-regions.json` protege rosto e íris ao trocar a cor do uniforme. Os perfis compartilhados foram atualizados somente para o Lanterna.

Para medir novamente ou promover esta versão sem alterar a arte:

```powershell
python -B apps/client/scripts/finalize-lantern-pixellab.py --approved --promote
python -B apps/client/scripts/build-carry-anchors.py --character lantern
```

Verificação: 84 PNGs nativos, 108 células com pixels visíveis e alfa iguais aos PNGs de origem, 54 células excedentes transparentes. Os hashes dos PNGs selecionados constam em `sources.json`. Após integração passaram 145 testes focados do cliente, 16 testes de atlas/encaixes/retratos, typecheck e build.
