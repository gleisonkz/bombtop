# Prompt-base — família Bombtop v1

Descreve **como o personagem é** (a família visual). Para **como ele vira sprite e entra no jogo**,
siga `concept/CHARACTER-RECIPE.md`.

Dois usos:

- **A. Descrição do PixelLab** (`create_character`, o que gera o sprite de verdade). Funciona para
  personagens originais e para fan art (o `create_character` aceita personagens de franquia).
- **B. Ilustração de conceito** (gerador de imagem, para aprovar o visual antes). Só para personagens
  **originais**: o modelo Pro do PixelLab recusa personagens de franquia, mesmo sem citar o nome.

## Variáveis do personagem

- **NOME:** [nome no jogo / arquétipo]
- **CABEÇA:** escolha uma e descreva
  - *capacete*: [forma, cor, visor, marcas]
  - *máscara*: [cor, desenho, olhos/lentes]
  - *cabelo e rosto*: [penteado e cor do cabelo, olhos, testeira/acessório]
- **ROUPA:** [peito, emblema, cintura, cores; braços e pernas]
- **COR DO JOGADOR:** [a parte da roupa que muda para a cor de cada jogador — uma área grande e de
  um tom só, como laterais/pernas, capa ou túnica; pele, cabelo, olhos e emblema ficam fixos]
- **ACESSÓRIO:** [arma, escudo, capa — opcional; precisa caber na silhueta parada]
- **JEITO:** [personalidade em 2–4 palavras, ex.: "confiante, amigável"]
- **ESPECIAL:** [o que ele faz no jogo; a pose do especial sai daqui, não do corpo base]

## A. Descrição do PixelLab (`create_character`)

Monte a `description` nesta ordem (o PixelLab lê melhor frases curtas separadas por vírgula):

```
chibi [NOME], adorable but battle-ready super-deformed toy action hero: huge perfectly rounded head
([CABEÇA]), very compact barrel torso, [ROUPA], big rounded [cor] gloves, oversized rounded [cor] boots,
round shoulders, chunky readable silhouette, [JEITO] stance, arms relaxed
```

Exemplo real (Homem-Aranha):

```
chibi Spider-Man, adorable but battle-ready super-deformed toy action hero: huge perfectly rounded head
(red mask with thin black web lines, two big white teardrop eye lenses with thick black rims), very
compact barrel torso, red chest with a black spider emblem, blue sides and blue short legs, big rounded
red gloves, oversized rounded red boots, round shoulders, chunky readable silhouette, confident friendly
stance, arms relaxed
```

Regras da descrição:

- **Nunca escreva "bomb"** (nem no acessório): o filtro do PixelLab bloqueia.
- Nada de pose de ação, efeito, arma disparando ou cenário: o corpo base é neutro, parado.
- Cite a parte da COR DO JOGADOR com um tom só e bem saturado (ex.: "blue sides and blue short legs"):
  é ela que o jogo repinta por matiz.
- Os parâmetros (tamanho, vista, proporções) estão na receita e são **fixos** para toda a família.

## B. Ilustração de conceito (só personagens originais)

Use the provided Bomberman trading-card image **only** as a visual reference for the round, compact 1990s
Japanese action-toy character proportions and finish. Create ONE entirely ORIGINAL full-body character
concept for the game Bombtop: **[NOME]**, head: **[CABEÇA]**, outfit: **[ROUPA]**, **[ACESSÓRIO]**,
personality: **[JEITO]**.

STRICT SHARED CHARACTER FAMILY STYLE: adorable but battle-ready super-deformed action hero; huge perfectly
rounded head (helmet, mask or hair as described) making about 40–45% of total standing height; large
simple expressive eyes; very compact barrel-shaped torso; short sturdy legs; big rounded gloves and
oversized toy-like boots; round shoulders, chunky readable silhouette. All anatomical parts share the
same visual scale and soft rounded geometry. Three-quarter front view with both boots planted on the same
horizontal line. Confident stance, arms naturally relaxed. Clean thick near-black outer contours, polished
2D cel-shaded retro Japanese game illustration, saturated but curated colors, solid materials with two or
three distinct shadow/highlight shapes, consistent top-left lighting, crisp edges. Face and silhouette
instantly readable as a small game character. Entire character centered and fully visible with generous
breathing room.

Keep the exact same body/head/hand/boot proportions, camera angle, outline weight, lighting direction and
rendering vocabulary for EVERY new character. Change only the head, costume, palette, emblem, equipment
and personality given above. Do not copy an existing licensed character, franchise logo or identifiable
costume.

Single isolated character on true transparent RGBA background. NO scene, glow, floor shadow, printed
texture, labels, UI, watermark, card layout, borders, extra characters, weapon effects, blurry contours,
cropped limbs, elongated realistic anatomy, tiny heads, thin human hands or skinny legs. This is a
CONCEPT illustration for style approval, not an animation sheet or pixel-art sprite.

Referência: `concept/references/bomberman-card-reference.png`.

## Checklist de aprovação (antes de animar)

- [ ] Cabeça com ~40–45% da altura; corpo, mãos e botas redondos e grossos.
- [ ] Lê bem pequeno: reduza a imagem para 20 px de altura (o tamanho na arena) — dá para saber quem é?
- [ ] Parado, de pé, braços relaxados, sem efeito nem arma disparando.
- [ ] A área da COR DO JOGADOR é grande, de um tom só, e não se confunde com o resto da roupa.
- [ ] Ao lado do Capitão, do Goku e do Homem-Aranha parece da mesma família.
