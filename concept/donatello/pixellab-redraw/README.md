# Donatello opção 4 — PixelLab

Referência aprovada: `../pixellab-preview/option-4.png`, sem reamostragem, com margem transparente em `approved-base.png`.

Personagem PixelLab: `8b856f61-5e44-468e-97cc-b05a61f6525a`. Estado de transporte: `6ad4649f-97e4-45fc-917b-c69243a62495`.

Foram geradas novamente todas as animações: **111 quadros**, 12 colunas e 18 linhas, células RGBA de **256×224**, atlas **3072×4032**, âncora (128;208). Nenhuma animação antiga foi mantida no atlas ativo. O jogo espelha a direita para a esquerda. As dimensões ficam abaixo de 4096 em ambos os eixos, sem reduzir os pixels do personagem.

| Linhas (base zero) | Ação | Quadros |
| --- | --- | --- |
| 0–2 | Parado: frente, lado, costas | 4 cada |
| 3–5 | Caminhada: frente, lado, costas | 6 cada |
| 6–7 | Dano e derrota | 6 cada |
| 8–10 | Defesa/ataque com bastão: frente, lado, costas | 9 cada |
| 11–13 | Transporte parado: frente, lado, costas | 4 cada |
| 14–16 | Transporte andando: frente, lado, costas | 6 cada |
| 17 | Apresentação de menu e vitória | 12 |

O bastão é uma peça contínua, empunhada nas poses comuns, de dano, derrota, ataque e apresentação. No transporte ele fica preso diagonalmente ao casco, com as mãos vazias elevadas para a bomba desenhada pelo jogo. O renderer mantém os anéis de movimento do especial, mas não desenha mais um segundo bastão físico flutuando na cintura.

`submitted.json` conserva os identificadores dos jobs e `generated/` as respostas originais. `selections.json` registra o mapeamento e as palmas; `manifest.json` registra dimensões, traduções fixas e hashes. Não há deformação de membros, escala por frame ou efeitos incorporados às fontes. O empacotador rejeita recortes e mantém as colunas excedentes transparentes.

O retrato, a escala de arena, o corpo do menu, os limites horizontais e os 30 encaixes de transporte foram atualizados somente para Donatello. Os demais personagens e as alterações simultâneas foram preservados.

## Reprodução

```powershell
python concept/donatello/pixellab-redraw/collect.py
python concept/donatello/pixellab-redraw/select.py
python concept/donatello/pixellab-redraw/pack.py
python concept/donatello/pixellab-redraw/promote.py
python apps/client/scripts/build-carry-anchors.py --character donatello
```

`collect.py` apenas consulta os jobs existentes; não cobra novas gerações. A chave permanece no ambiente Windows. O gerador antigo `build-character-sheet.py donatello` corresponde à arte anterior e não deve ser usado para esta versão.

Prévias: `walk-preview.gif`, `carry-preview.gif`, `cast-preview.gif` e `menu-preview.gif`, extraídas do atlas de produção. Revisão do bastão: `weapon-review-report.json` e `component-review.json`. A inspeção estática não substitui a avaliação visual final do usuário durante o jogo.
