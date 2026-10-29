# GOKU A1 — spritesheet por esqueletos

Integrado no workspace `C:/Users/jovipds/.codex/worktrees/8090/bombtop`.

A aparência vem exclusivamente do personagem PixelLab `a2190442-8767-46f0-a293-9a62cc83107c`, derivado do sprite mais alto aprovado. As vistas A1 de frente, direita e costas foram somente centralizadas, sem redimensionamento, em PNGs 128×160. A folha anterior forneceu imagens apenas ao estimador oficial de esqueletos; nenhum de seus pixels foi usado como referência de aparência na geração.

`skeletons/pose-*` registra as 108 poses do jogo e oito poses de menu. `retarget.py` mantém os comprimentos dos membros e os deslocamentos de olhos, orelhas e cabeça do próprio A1. Os ângulos vêm das poses; o registro no chão ocorre nas coordenadas do esqueleto, nunca por normalização ou esticamento de bitmaps. A queda foi refeita em sete poses contínuas em `death.py`. A caminhada frontal de transporte combina o passo do jogo com os braços levantados do esqueleto de transporte.

Todas as novas poses são desenhadas por `animate_with_skeleton_v3` a partir da vista A1 correspondente. `jobs.json` seleciona os resultados e as correções, e `outputs/<job>/` preserva os retornos imutáveis. `collect.py` baixa os PNGs inteiros e verifica tamanho/formato; não gera, recorta, colore ou retoca o personagem.

## Jogo

- 108 células ocupadas: 105 desenhos distintos e três holds explícitos da pose parada de transporte.
- PNGs nativos 128×160; células 132×164, com borda transparente de 2 px.
- Atlas 1188×2952, grade 9×18, apoio (66,150), corpo de referência 104 px.
- 54 células excedentes transparentes. Nenhum poder, objeto ou partícula incorporado.
- O atlas é uma cópia pixel a pixel dos PNGs selecionados, apenas posicionados na grade.

## Transformação

São 27 poses distintas, escolhidas em `morph-jobs.json`, com movimento de corpo interpolado em coordenadas de esqueleto e novos desenhos pelo PixelLab. As fases são: preto normal (0–8), preto começando a levantar (9–11), mechas pretas/douradas (12–14), dourado com raízes e mechas pretas restantes (15–17), Super Saiyajin completo com cabelo espetado para cima (18–26).

As três referências intermediárias foram geradas por inpainting somente no cabelo do A1. A máscara (24,12,80,66) mantém todo o corpo e o traje fora dela pixel a pixel idênticos. `hair-phase-jobs.json` registra essas gerações. A referência SSJ1 é `reference/ssj1-south.png`, derivada do mesmo A1; as tentativas apenas pintadas de amarelo ficaram rejeitadas.

A apresentação usa 60 frames a 20 fps: avanço pelas 27 poses, hold explícito da forma dourada, retorno reverso e repouso. Nenhum frame de imagem é interpolado ou misturado por script. Os 7920×164 pixels ficam abaixo de 8192 de largura. A cadência própria da imagem de menu não altera caminhada, golpes ou idle durante a partida.

Quatro pequenos resíduos isolados de fundo foram removidos por inpainting em máscaras que não tocam o personagem. `background-repair-proof.json` comprova que todos os pixels não mascarados permaneceram idênticos e as máscaras ficaram transparentes.

## Reprodução

```powershell
python concept/goku/a1-redraw/collect.py
python apps/client/scripts/pack-goku-a1.py --anchor 64 148
python apps/client/scripts/finalize-goku-a1.py --promote
python apps/client/scripts/build-carry-anchors.py --character goku
```

O finalizador confere que os PNGs pertencem aos jobs selecionados e correspondem ao candidato antes de promover. Ele atualiza apenas os metadados do Goku: grade, apoio, velocidade de apresentação, retrato, pontos das mãos, origem do golpe e limites do menu.

Validação: 9 testes do empacotador, 2 de retratos, 142 testes focados do cliente, typecheck e build. A igualdade dos pixels das 108 células com suas fontes e as caudas vazias foram verificadas. `delivery.json` registra os hashes finais. Prévias: `transform-preview.gif` e `death-preview.gif`.
