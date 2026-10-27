# Correção dos exemplos enviados pelo usuário

Foram regeneradas 19 poses nativas do PixelLab: especial de frente (linha 8) e poses de costas com rosto indevido (linhas 2, 10 e 16). O restante da folha foi preservado.

O esqueleto antigo do especial tinha pontos das orelhas mais afastados que na referência A1. Os novos pedidos usam os deslocamentos dos pontos de cabeça da própria referência em relação ao pescoço, preservando as coordenadas de braços, pernas e mãos. Nas vistas de costas, os pontos de nariz/olhos ficam atrás da cabeça no mapa de profundidade. Isso muda somente as instruções de pose enviadas ao gerador: nenhum pixel de rosto ou orelha foi retocado por script.

`jobs.json` registra os quatro jobs novos; `skeletons.json` registra os esqueletos enviados; `raw/` conserva os PNGs nativos. `before/` conserva os 19 PNGs substituídos. A seleção principal de jobs e a folha `../candidate.png` já incorporam os novos resultados. O atlas de produção do jogo permanece preservado.

`corrected-preview.png` mostra as mesmas oito posições dos exemplos do usuário, agora regeneradas. `cast-preview.gif` mostra o especial de frente.
