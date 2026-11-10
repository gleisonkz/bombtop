# Prompt-base — personagem novo no PixelLab

Todo personagem jogável desde o Capitão é feito no PixelLab (`create_character`) com as configurações abaixo; é o que
mantém o elenco coerente na arena. O passo a passo inteiro (regra, animações, sheet, código, som, telas) está em
[CHARACTER-RECIPE.md](CHARACTER-RECIPE.md). O Bomber (mascote) é exceção: arte própria gerada fora do PixelLab, regida
por [CHARACTER-IDENTITY.md](CHARACTER-IDENTITY.md); não use aquele acabamento nem os traços dele (cabeça de bomba,
olhos âmbar, pavio, armadura violeta, capa vermelha) nos outros.

## 1. Antes de escrever

Preencha:

- **NOME**: como aparece no PixelLab: `"<Nome> HD"` (refações: `HD 2`, `HD v3`).
- **ROSTO**: olhe uma imagem do personagem original e descreva: cor e forma dos olhos, sobrancelhas, nariz/focinho,
  boca, orelhas, cabelo, pele. Só o nome dá um genérico (a Pantera saiu um gato fofo até dizer "big round yellow eyes
  with black pupils, dark pink triangle nose, light pink muzzle and belly").
- **ROUPA**: peças, cores e materiais, de cima para baixo; emblema; acessório na mão (cajado, varinha).
- **ÁREA DA COR DO JOGADOR**: uma peça grande e de uma cor só (capa, cachecol, camisa, bandana, forro do casaco) que o
  jogo recolore (`hues` em `SHEETS`). Sem peça assim, acrescente uma (Pikachu, Bugs e Pantera ganharam cachecol). Evite
  que pele, boca ou rosto caiam na mesma faixa de matiz.
- **ATITUDE**: expressão neutra e confiante, boca fechada, olhos abertos.

## 2. Parâmetros fixos (`create_character`, modo padrão)

| parâmetro | valor |
|---|---|
| `name` | `<Nome> HD` |
| `size` | `128` (tela de 180 px) |
| `n_directions` | `4` |
| `view` | `low top-down` |
| `outline` | `single color black outline` |
| `shading` | `detailed shading` |
| `detail` | `high detail` |
| `proportions` | `{"type": "custom", "head_size": 1.8, "arms_length": 0.8, "legs_length": 0.75, "shoulder_width": 0.9, "hip_width": 0.9}` |

## 3. Descrição (`description`)

Em inglês, nesta ordem, uma frase por bloco:

```
Chibi [NOME / ARQUÉTIPO], big head, small sturdy body, standing straight, arms relaxed at the sides.
Face: [ROSTO: olhos, sobrancelhas, nariz, boca, cabelo, pele], closed mouth, eyes open, confident look.
Outfit: [ROUPA de cima para baixo, com cores e materiais], [EMBLEMA].
[ÁREA DA COR DO JOGADOR] in solid [cor], clearly separate from skin and face.
[ACESSÓRIO, se houver: "holding a short wooden staff in the right hand"].
Clean shapes readable at small size, no background, no floor shadow, no text, no visual effects.
```

Exemplo no formato (Pelé, montado a partir do que o `CLAUDE.md` descreve dele):

```
Chibi Pele, legendary Brazilian football player, big head, small sturdy body, standing straight, arms relaxed.
Face: dark brown skin, short black curly hair, friendly dark eyes, thick eyebrows, closed smile.
Outfit: 1970 Brazil kit, yellow jersey with green collar and cuffs, blue shorts, white socks, black cleats.
Blue shorts in solid blue, clearly separate from skin.
Clean shapes readable at small size, no background, no floor shadow, no text, no visual effects.
```

**Não escreva**:

- "bomb" em lugar nenhum (o filtro bloqueia; a bomba carregada é desenhada pelo jogo);
- efeitos (raio, fogo, aura, teia, brilho): o PixelLab cola no sprite e eles mudam a cada quadro; o efeito é do
  renderer ou de script de arte;
- objeto solto na mão que precise ficar igual em toda animação (bandeira, bola): peça a mão vazia e desenhe por script;
- "smiling with teeth", "breathing", "eyes closed": templates depois abrem a boca e fecham os olhos.

## 4. Conferir antes de animar

Todas as animações herdam o corpo base: refaça agora se algo estiver errado.

- 4 direções com o mesmo rosto, roupa e proporção; costas sem rosto nem emblema.
- Lado errado ou de costas virado para nós, frente boa: crie `"<Nome> HD v3"` com `mode: "v3"`,
  `reference_image_url` = a frente boa e uma descrição do lado (perfil, um olho) e das costas (sem rosto).
  Custa 4 gerações e gira o mesmo desenho.
- Rosto ou cor errados num detalhe: repinte a frente e o lado e importe como v3 com todas as direções dadas (foi
  assim com o Lanterna: olhos verdes, boca fechada).
- Lados desenhados virados para a esquerda: tudo bem, o `build-character-sheet.py` espelha (Penélope).
- Sombra no chão ou manchas cinza: limpe no script do sheet (`no_floor_shadow`, `no_blots`).

## 5. Animações

Sempre com esqueleto (`skeleton-v3` com template, ou `animate_with_skeleton_v3` com nossos pontos); os modos só de
texto redesenham cada quadro e perdem detalhes. Tabela, quadros e problemas conhecidos em
[CHARACTER-RECIPE.md](CHARACTER-RECIPE.md#animações-animate_character). Nas descrições de pose de costas, escreva
"seen from behind, back view": sem isso o PixelLab vira o personagem para nós.

Depois de pronto, apague no PixelLab as versões e animações não usadas.
