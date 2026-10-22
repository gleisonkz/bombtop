# Naruto — redesign Bombtop (pendente de geração)

## Referências

- `references/bomberman-card-reference.png`: proporções arredondadas, acabamento 2D, volume e silhueta.
- `../apps/client/public/sprites/naruto.png`: identidade visual, direções e animações existentes do Naruto.
- `PROMPT-BASE.md`: regras de consistência da família Bombtop.

## Identidade a preservar

Naruto reconhecível pelo cabelo loiro espetado, faixa na testa, marcas nas bochechas e roupa predominantemente laranja e azul-marinho. Reinterpretar cabeça e cabelo como um volume grande e arredondado, com tronco curto, braços e pernas compactos, mãos e calçados grandes. Conservar o personagem e a leitura das ações; unificar as proporções e o acabamento com o modelo arredondado de Bomberman.

## Prompt para o conceito piloto

Use both attached visual references. Redesign Naruto Uzumaki as a compact rounded action-toy hero for Bombtop. Reference one determines the rounded 1990s Japanese arcade toy character shape language; reference two determines Naruto's identity, hair, forehead protector, cheek marks, clothing colors and action vocabulary. Oversized head approximately 42% of standing height, rounded face and hair mass, short sturdy legs, oversized hands and rounded footwear, barrel-like torso, thick clean dark outlines, punchy orange/navy palette, two or three crisp cel-shaded tones per material, top-left lighting, charming confident expression, three-quarter front pose with both feet aligned. ONE fully visible character, true transparent background; no title, border, scenery, glow, labels, poster composition or other characters. Produce a concept illustration first; only after visual acceptance author each sprite animation as distinct poses in the fixed grid below.

## Contrato de sprites para integração

O renderer existente (`apps/client/src/render/sprites.ts`, `SHEETS.naruto`) espera uma grade de **9 colunas × 18 linhas**, células de **132 × 164 px**, atlas de **1188 × 2952 px**. Manter âncora (**66.5, 159**), lado direito como direção lateral canônica e os offsets de efeito existentes durante a substituição inicial.

| Linha | Ação | Quadros |
| --- | --- | ---: |
| 0–2 | Idle: baixo, lado, cima | 4 por direção |
| 3–5 | Walk: baixo, lado, cima | 6 por direção |
| 6 | Stun | 6 |
| 7 | Death | 7 |
| 8–10 | Cast/Rasengan: baixo, lado, cima | 9 por direção |
| 11–13 | Carry idle: baixo, lado, cima | 4 por direção |
| 14–16 | Carry walk: baixo, lado, cima | 6 por direção |
| 17 | Lobby | 8 |

Todos os quadros devem ter poses realmente desenhadas e distintas para movimento, com fundo RGBA transparente e pés registrados na mesma linha nos quadros apoiados. Não esticar, redimensionar separadamente ou duplicar um desenho estático para simular animação. Testar o conceito isoladamente antes de substituir o atlas carregado pelo jogo.

## Estado

Especificação preparada. `naruto.png` original permanece em uso; nenhuma variante nova foi registrada no renderer. A geração do piloto falhou antes de produzir um arquivo, com erro da ferramenta `ChatGPT image conversation did not expose its composer`.
