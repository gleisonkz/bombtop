# Bomber — folha compilada

`bomber-sheet.png` é a folha compilada: PNG RGBA transparente, 936 × 2736,
9 colunas × 19 linhas, células de 104 × 144. Pés no y local 139; centro x 52.
Escala na arena 0,22; altura nominal 100 px. A direção lateral olha para a direita;
o renderer espelha para a esquerda. As células restantes de cada linha ficam vazias.

| Linha (base zero) | Animação | Quadros |
| --- | --- | --- |
| 0–2 | Parado: frente, direita, costas | 4 por direção |
| 3–5 | Andando: frente, direita, costas | 6 por direção |
| 6 | Tonto | 6 |
| 7 | Derrota, queda, explosão e fumaça | 7 |
| 8–10 | Especial: frente, direita, costas | 9 por direção |
| 11–13 | Carregando parado, braços erguidos | 4 por direção |
| 14–16 | Carregando andando, braços erguidos | 6 por direção |
| 17 | Celebração do lobby | 8 |
| 18 | Voo do menu, capa e pavio animados | 9 |

As 117 poses são desenhos distintos. A bomba carregada e a mega bomba são objetos
do renderer; não estão embutidas no personagem. Esquerda reutiliza a direita espelhada.

Regenerado em 25/10/2026 com a ferramenta integrada de geração de imagens da OpenAI,
usando a folha anterior como referência visual. Prompt principal: preservar cabeça
esférica de ferro preto, olhos âmbar, pavio aceso, armadura violeta, capa vermelha,
proporções compactas e acabamento arcade 2D; desenhar todas as ações e voo do menu
sobre transparência. Duas gerações complementares corrigiram braços erguidos e os
seis passos frontais ao carregar. Os quadros foram recortados, alinhados e compilados;
nenhum quadro foi repetido para simular uma animação nova.

Para reconstruir as duas texturas de execução, na raiz do projeto:

```powershell
python apps/client/scripts/pack-bomber.py
python apps/client/scripts/test-bomber.py
```

O empacotador exporta as 18 primeiras linhas para `bomber-atlas.png` (936 × 2592).
O menu usa `menu-flight-source.png` (1152 × 1152, grade 3 × 3), regenerado com
quadros isolados e margem transparente para eliminar mãos de poses vizinhas.
Essa fonte gera `bomber-title-fly.png` (768 × 768, células de 256 × 256).
A última linha compilada contém as mesmas nove poses reduzidas para inventário;
os testes verificam que ela corresponde à fonte em alta resolução. Somente as duas
texturas de execução ficam em `public/sprites`; as fontes não entram no precache da PWA.

Na arena, o personagem usa filtragem linear ao ser reduzido, como os demais
personagens em HD. Isso evita as bordas serrilhadas do antigo filtro nearest.
API confirmada na [documentação do PixiJS 8.22](https://github.com/pixijs/pixijs/blob/v8.22.0/src/rendering/__docs__/textures.md).

A referência técnica de [alpha e bounding boxes do Pillow](https://pillow.readthedocs.io/en/stable/reference/Image.html)
orientou o recorte por transparência e a preservação de RGBA no empacotamento.
