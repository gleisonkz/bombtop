# Bomber — folha compilada

`bomber-sheet.png` é o master HD: PNG RGBA transparente, 1872 × 5472,
9 colunas × 19 linhas, células de 208 × 288. Âncora master (104, 280).
O runtime usa células de 104 × 144, âncora (52, 140), escala 0,22 e altura nominal
100 px. A direção lateral olha para a direita;
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
anexando a arte de menu aprovada como referência real de identidade e acabamento.
Três grupos de desenhos novos cobrem movimento, ações e carregamento. A arte do
menu aprovada foi preservada. Os quadros foram isolados por alfa, alinhados em
células com margem e compilados; nenhum quadro foi repetido para simular animação.

Direção reutilizável: [identidade da família](../CHARACTER-IDENTITY.md),
[JSON de referência e contrato de produção](../characters.identity.json) e
[prompt-base para outros personagens](../PROMPT-BASE.md).

Prompts usados: manter cabeça esférica preta com reflexo superior esquerdo, olhos
âmbar, colar dourado e pavio aceso, armadura violeta, luvas e capa vermelhas,
pequeno fecho hexagonal dourado e volumes compactos de brinquedo; ilustração arcade
2D com gradientes suaves e contornos limpos. Grupo movimento: quatro idles e seis
passadas por vista frente/direita/costas. Grupo ações: tonto, derrota, plantar a
mega bomba nas três vistas e celebração. Grupo carregamento: mãos erguidas sem
bomba desenhada, idles e passadas nas três vistas. Transparência real, escala e
âncoras estáveis, sem poses de vizinhos ou membros cortados em todos os grupos.

Para reconstruir as duas texturas de execução, na raiz do projeto:

```powershell
python apps/client/scripts/pack-bomber.py
python apps/client/scripts/test-bomber.py
```

O empacotador lê a grade do JSON, reduz cada quadro das 18 primeiras linhas
individualmente com Lanczos e monta `bomber-atlas.png` (936 × 2592). Assim o master
guarda o detalhe sem aumentar a textura de execução e sua memória no celular.
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
