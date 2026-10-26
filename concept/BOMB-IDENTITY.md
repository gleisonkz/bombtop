# Bombtop — identidade rígida das bombas v1

## Referência e contrato

Referência visual prioritária: trio de bombas apresentado pelo usuário em 21/10/2026, na ordem normal, pierce e remote. A referência é uma ilustração de conceito, não uma spritesheet. O atlas atual do jogo possui três células RGBA de 128 × 128, em uma linha 384 × 128, na ordem `normal`, `pierce`, `remote`; centro do corpo na coordenada local aproximada (64, 76). Os novos estágios serão atlas independentes com esse mesmo contrato, preservando `apps/client/public/sprites/bombs.png` até aprovação e integração.

## Prompt mestre de identidade (usar com a referência visual anexada)

Create EXACTLY THREE original game-bomb mascots, in fixed left-to-right order NORMAL, PIERCE, REMOTE, preserving the ATTACHED reference image as the authoritative visual identity. Every bomb is an almost perfect round deep midnight navy-blue sphere, visually identical body volume, face, silhouette radius, glossy upper-left white-blue oval specular highlight, subtle cobalt-blue left rim bounce light, rich indigo shadow on the lower-right, and strong clean near-black contour. Every bomb has EXACTLY TWO small black vertical oval eyes with one tiny upper-left white catchlight each; no mouth, eyebrows, limbs, text or additional face elements. The eyes must occupy the same coordinates in all variants. The image language is premium 2D Japanese arcade illustration with controlled cel-shading, precise reflective metal, soft but clean transitions within surfaces, consistent upper-left key light and a fully transparent background.

NORMAL: one silver brushed metal collar tilted slightly clockwise on the top-right shoulder, thick curved braided beige rope wick bending up and right, a tiny golden-white burning star at its tip. No spikes or antenna. PIERCE: exactly eight outward-pointing short polished warm-gold conical spikes spaced around its round silhouette, a centered silver metal collar with a short golden stem and luminous amber bulb. No rope fuse. REMOTE: one centered silver collar and straight dark metal antenna stalk rising to a red glossy spherical signaling light. No rope wick or spikes. The bulb is red only for REMOTE and amber only for PIERCE.

The three bomb bodies must retain one common spherical radius and position. Keep the outlines, eyes, highlight, navy palette, shading, collar metal, and general anatomy stable across every state. Only the function-specific appendages and state-specific light intensity or detonation deformation may change. Never reinterpret the face, replace the eye shape, add new limbs, change the bulb colors, exchange spikes or antennas, add a checkerboard, scene, drop shadow, glow rectangle, lettering, labels, frames, borders, icons, extra objects or clipped parts.

PRODUCTION GRID: one horizontal 384×128 PNG RGBA image, exactly THREE isolated 128×128 cells, no margins, spacing or dividers. Every bomb completely contained inside its own cell. Common body center near local (64,76); consistent apparent size across all cells. Real transparent pixels outside silhouettes; no opaque background. Smooth cel shading matching the reference, not accidental downsampled pixel art. Distinct stages must clearly communicate the requested state while preserving identity.

## Estados derivados

1. `armed`: base visual estável com pequenas luzes de funcionamento; pavio normal aceso, bulbo pierce âmbar e antena remote vermelha.
2. `warning`: mesmo volume, olhos e acessórios; o pavio produz faísca branca-amarela mais intensa, o bulbo âmbar da pierce pulsa para branco-amarelo e a luz da remote fica vermelho-vivo com halo vermelho isolado.
3. `critical`: contorno e face legíveis, mesma escala e posições; pequena energia contida na superfície, faísca da normal intensa, picos da pierce iluminados e sinalizador vermelho da remote em potência máxima, com áreas de brilho contidas na própria célula.
4. `detonation`: sequência posterior de efeitos de explosão a especificar com duração e comportamento do jogo; não confundir uma imagem estática de três bombas com a animação completa do efeito.

## Aceitação

Conferir RGBA, dimensões exatas, três células preenchidas, fundo transparente, ausência de elementos fora da célula e consistência dos olhos e corpos. Avaliar visualmente cada saída junto da referência. Não substituir o atlas em uso sem verificar compatibilidade com a lógica de renderização.

## Mega do Bomber — variante própria

A mega bomba especial não é uma quarta variante do trio normal/pierce/remote.
Ela usa a esfera e o acabamento arcade do jogo, mas incorpora a identidade do
Bomber: ferro carvão com reflexo superior esquerdo, olhos âmbar em fenda,
reforços violetas, juntas incandescentes contidas e pavio central com colar
dourado. O desenho evoca um núcleo pesado invocado quando o personagem se
agacha e pressiona as duas luvas contra o chão. Os olhos ovais do trio continuam
reservados às bombas comuns; a mega usa os olhos ameaçadores do personagem.

Fonte armada: `bombs/mega-bomber.png`; folha de estados `bombs/mega-stages.png`,
grade 2 × 2, na ordem armada/aviso/crítica/início da detonação. Execução em
`apps/client/public/sprites/bombs/mega/`, quatro PNGs RGBA 512 × 512 e suas máscaras
de flash branco. O estágio acompanha os mesmos limiares de pavio das bombas comuns.
Âncora de execução (250, 310), brilho do pavio (254, 76),
escala base 0,025 e fator mega 1,6. A pulsação altera os dois eixos igualmente:
nunca esticar verticalmente a bomba comum para representar a especial.
O [JSON da família](characters.identity.json) registra a variante em
`bomberIdentity.specialBomb` e as poses de invocação nas linhas 8–10 do master.

A invocação visual dura 36 ticks: concentração violeta, impacto âmbar no tick 12,
emergência uniforme da bomba e dissipação de poeira/faíscas. A observação registra
uma vez a bomba recém-criada e sua invocação, depois usa os ticks da simulação.
Carregar, arremessar ou mover cancela o efeito; outra invocação não reinicia uma
bomba antiga de pavio pausado. Lite e movimento reduzido omitem o efeito decorativo. Alcance,
dano, pavio e recarga da simulação não são alterados por esses efeitos.
