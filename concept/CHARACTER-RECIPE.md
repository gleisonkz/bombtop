# Receita — personagem novo no Bombtop

Passo a passo testado (é como o Homem-Aranha foi feito). O visual vem de `concept/PROMPT-BASE.md`;
aqui está como ele vira sprite, especial, som e entra em todos os lugares do jogo.
Ordem: **regra (shared) → sprite → código do cliente → som → telas → docs**. TDD em cada passo de código.

## 0. Antes de começar

- **Especial:** defina o que ele faz em uma frase, com números (alcance em casas, duração, recarga).
  Reaproveite um tipo que já existe sempre que der:
  - tiro em linha que afeta o primeiro jogador: `blast()` + `BLASTS` em `special.ts` (gelo, raio, teia);
  - carregar e disparar: `Player.charge` (Kamehameha);
  - investida: `Player.rasengan` (Rasengan);
  - algo no próprio tile: bomba gigante (`Bomb.mega`).
- **Tempos padrão:** atordoar = `SPECIAL_STUN_TICKS` (3 s, igual para todos); recarga 20 s
  (`SPECIAL_COOLDOWN`), 25–30 s só para especiais muito fortes. O escudo do Capitão deve devolver
  qualquer tiro em linha (`shieldAt`).
- **Créditos PixelLab:** um personagem completo gasta ~75 gerações (personagem + 5 animações por
  modelo + 2–3 por esqueleto próprio, com refações). Confira `get_balance` antes.

## 1. Regra do jogo — `packages/shared`

1. Teste primeiro: `test/<nome>.test.ts` (copie `test/spider.test.ts`: acerta, erra fora do alcance,
   bloco para, escudo devolve, recarga).
2. `state.ts`: nome em `CHARACTERS` (+ campo novo em `Player` se houver estado, ex.: `webbed`).
3. `constants.ts`: alcance/duração. `special.ts`: o especial em `useSpecial`.
4. `step.ts`: se o estado impede agir, trate como `frozen`/`webbed`. `arena.ts`: valor inicial do campo.
5. `room/session.ts`: nome do bot em `BOT_NAMES`. `test/protocol.test.ts`: lista de `CHARACTERS`.
6. Rode `pnpm -C packages/shared bench` se mexeu em algo que roda todo tick.

## 2. Sprite — PixelLab

### Criar o personagem (`create_character`, modo padrão)

| parâmetro | valor |
|---|---|
| `description` | da seção A do `PROMPT-BASE.md` |
| `size` | `128` (tela de 180 px) |
| `n_directions` | `4` |
| `view` | `low top-down` |
| `outline` | `single color black outline` |
| `shading` | `detailed shading` |
| `detail` | `high detail` |
| `proportions` | `{"type": "custom", "head_size": 1.8, "arms_length": 0.8, "legs_length": 0.75, "shoulder_width": 0.9, "hip_width": 0.9}` |

Nome no PixelLab: `"<Nome> HD"`. Confira as 4 direções antes de animar: se o rosto, emblema ou
proporção estiverem errados, refaça agora (todas as animações herdam o corpo base).

**Lado ou costas errados, frente boa** (o Pikachu saiu com as costas e a cauda no corpo e olho e bochecha na
cabeça de lado): não gere de novo no modo padrão. Crie `"<Nome> HD v3"` com `create_character` `mode: "v3"`,
`reference_image_url` = a frente boa, `n_directions: 4` e uma descrição dizendo como é o lado (perfil, um olho, cauda
atrás) e as costas (sem rosto); custa 4 gerações e gira o mesmo desenho. As animações de frente já feitas continuam
valendo (é o mesmo desenho); refaça só lado e costas no personagem v3.

### Animações (`animate_character`)

Sempre com esqueleto. Os modos `template` e `v3` só de texto redesenham cada quadro e perdem detalhes
(o escudo sumiu, a estrela foi parar nas costas).

| linha do sheet | como | direções |
|---|---|---|
| idle | `mode: skeleton-v3`, modelo `breathing-idle` | south, east, north |
| walk | `skeleton-v3`, `walking-6-frames` | south, east, north |
| stun (tonto) | `skeleton-v3`, `taking-punch` | south |
| death | `skeleton-v3`, `falling-back-death` | south |
| cast (especial) | **esqueleto próprio**: `animate_with_skeleton_v3` com nossos pontos | south, east, north |
| carry walk | **esqueleto próprio** (braços para cima segurando sobre a cabeça) | south, east, north |
| carry idle | quadros parados do carry walk (0, 0, 3, 3) | — |
| lobby | `mode: v3`, `frame_count: 8`, pose de vitória descrita em texto | south |

West é o east espelhado pelo jogo (não gere).

**Esqueleto próprio:** parta dos pontos do próprio personagem parado (as pernas mudam de um para
outro) e mova só braços/tronco quadro a quadro. Guarde os JSON dos pontos (o do Homem-Aranha ficou em
`spider-kp/`). O esqueleto tem que bater com a pose do sprite: um walk de modelo sobre um estado de
braços erguidos desenhou braços a mais.

**Problemas conhecidos:**
- **"bomb" no texto é bloqueado** pelo filtro (bloqueou até um estado "Carry" do Thor). O carry é pose
  de esqueleto, e o jogo desenha a bomba por cima da cabeça.
- O modelo `fireball` desenha fogo saindo da mão: não use para especial que não é de fogo.
- Efeito (teia, raio, gelo) **não vai no sprite**: quando o PixelLab desenhar um, segure o quadro limpo
  no `build-character-sheet.py`. O efeito é desenhado pelo renderer ou por script de arte.
- Cabeça que muda a cada quadro (boca, olhos, queixo): rode
  `scripts/lock-walk-head.py <nome>` depois do sheet (cadastre as linhas de idle/walk em `SHEETS` lá).
- Quadro com sujeira (mancha no olho): pule no mapeamento do cast (ex.: `SPIDER_CAST`).

### Montar o sheet

1. Baixe os quadros como `<pasta>/<animação>/<direção>/<i>.png` (south/east/north).
2. `scripts/build-character-sheet.py`: entrada em `CHARACTERS` com as 18 linhas na ordem dos outros
   (idle ×3, walk ×3, stun, death, cast ×3, carryIdle ×3, carryWalk ×3, lobby) e, se precisar,
   uma função `<nome>_frames` (veja `spider_frames`) e o ponto da mão para o efeito (`muzzle`).
3. `python build-character-sheet.py <nome> <pasta> public/sprites/<nome>.png` — ele imprime as medidas
   (`width`, `height`, `frameW`, `frameH`, `anchorX/Y`, `bodyH`, `muzzle`) para o `SHEETS`.
4. Registre em `public/sprites/LICENSES.md`.

## 3. Código do cliente — `apps/client/src`

- `render/sprites.ts` → `SHEETS.<nome>`: medidas do passo anterior, `strips(...)` iguais aos outros,
  `scale` para o corpo ficar com **~21–22 px na arena** (`bodyH × scale`; Capitão 124×0,17, Homem-Aranha
  152×0,139), e a cor do jogador:
  - `hues`: faixa de matiz da área que muda de cor (a COR DO JOGADOR do prompt);
  - `hueBase`: a cor original dessa área (RGB);
  - `keepFor`: cores de jogador que se confundiriam com o resto da roupa → esse jogador fica com a original.
- Visual do especial e do estado: função pura em `sprites.ts` (testada) + desenho em `render/renderer.ts`.
- `ui/sheet-art.ts` (`CHARACTER_SHEETS`), `main.ts` (`renderer.useSheet`), `ui/lobby.ts` (nome em pt-BR).
- Se o estado impede andar: `net/prediction.ts` (não prever movimento) e `audio/local-cues.ts`
  (não tocar som de input). Se o especial é um tiro: `game/online-game.ts` mostra o tiro na hora (como o gelo).

## 4. Som — `scripts/build-sfx.mjs`

- Fontes no The Sounds Resource, baixadas pelo Chrome do usuário (o site tem Cloudflare), com
  permissão a cada download; ficam em `E:/sfx-src/<jogo>/` (fora do repo).
- Vozes obrigatórias: `<nome>-pick` (escolhido no lobby), `<nome>-death`, `<nome>-win`,
  `<nome>-special` (ou o grito dentro do som do especial). Mais os efeitos do especial.
- Ouça antes de cortar (faster-whisper ajuda a achar a fala). Registre o id do asset no `build-sfx.mjs`.
- Ligue em `audio/voices.ts`, `audio/sound.ts` (volume), `audio/cues.ts` (quando toca) e
  `public/sfx/*.m4a` (gerados).

## 5. Telas (todas obrigatórias — os testes falham sem elas)

- **Guia** `/personagens`: `ui/character-guide.ts` (história, especial com dicas, recarga, cor) e
  `game/showcase.ts` (`specialShowcase`: cena curta com o especial acertando um rival).
- **Intro do título**: `game/intro.ts` — um lugar na cena, um cartão com o nome e um momento usando o
  especial (ajuste `INTRO_TICKS`, `CARDS`, `LOGO_FROM`; cor própria via `Intro.colors` se repetir a de outro).
- **Fila do título**: `ui/menu.ts` + CSS em `index.html` (conferir que não estoura no celular em pé).
- Conferir no navegador em **desktop, tablet em pé e deitado, celular em pé e deitado**, e jogar
  uma partida contra bot usando o especial (sem erro no console).

## 6. Fechar

- `pnpm test` e `pnpm typecheck` verdes.
- `CLAUDE.md`: linha do especial na tabela, parágrafo do personagem, fonte do som.
- Dois commits: `feat(shared)` (regra) e `feat(client)` (sprite, telas, som). Push no `main` = deploy.
