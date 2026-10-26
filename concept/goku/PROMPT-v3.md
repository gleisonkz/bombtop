# Prompt e referência — transformação fiel ao Goku base

Ferramenta: `image_gen`, com fundo transparente. A ferramenta não expõe o
identificador exato do modelo. A imagem de referência foi anexada de verdade.

Referência: primeiro quadro de `apps/client/public/sprites/goku.png`, recorte
(0, 0, 146, 159), ampliado para 584 × 636 com NEAREST, sem redesenhar pixels.
Arquivo: `base-front-reference.png`.

## Prompt enviado

Faithful pixel-art animation expansion of the EXACT attached Goku sprite.
Image1 is the ONLY authoritative character AND style reference. Preserve this
character literally: same small oval face and small eyes, same slender relatively
long body, same narrow shoulders and slim arms, same dark pixel outlines, same
sparse flat orange pixel shading and navy-blue clothes, same chest badge, same
boots, same asymmetric BLACK hair with broad spikes pointing left. The reference
is low-resolution PIXEL ART enlarged 4x, not smooth anime illustration. Your
output MUST also be low-resolution pixel art with clearly visible square pixels
and restrained 3-tone shading, like an extension made by the original sprite
artist. Do NOT redesign as a chibi mascot, do not enlarge the head or eyes, do not
broaden body/muscles, no modern glossy anime drawing, no smooth vector linework,
no airbrush, no white contour. Start from the reference drawing. Draw its
16-frame Super Saiyan transformation loop. Production spritesheet, transparent
background, equal 4x4 grid, each cell with one full body in same scale, feet
planted consistently, generous transparent gutters. No text labels grids ground
or presentation. Keep reference body/head proportions completely fixed
throughout. Action involves only slight knee bends, fists clenching at sides, a
small mouth-opening shout, hair becoming upright golden spikes of comparable
volume, golden outline flame aura BEHIND the body. Aura is narrow open pixel
flame strokes with transparent gaps, NOT solid filled yellow, no gigantic aura,
no soft glows. Sequence reading left-right top-bottom: 0 original black-hair
reference neutral;1 black hair fists clenched;2 slight crouch black hair first
gold sparks;3 black hair powerup slim gold aura;4 shouting black-to-gold hair
transition;5 full gold Super Saiyan small teal eyes;6 gold hair clenched fists
thin golden aura;7 same gold with one tiny cyan lightning;8 gold hair aura
flickers;9 gold hair relax fists slightly;10 gold hair aura smaller;11 gold hair
just few sparks;12 mostly black hair small gold tips;13 black hair last few
sparks;14 black hair settling to original pose;15 original neutral. Same fixed
feet baseline in every cell, body's height same as reference, only hair
silhouette may change. Treat as editing the original pixel sprite into new
poses, NOT interpreting or restyling it. The highest priority is matching the
attached original sprite at native pixel scale. All16frames isolated with at
least16px gutters and no cross-cell glow.

## Aplicação prática

O resultado gerado exige revisão: o tamanho e a distribuição não seguem
perfeitamente a grade pedida. `pack-goku-lobby.py` registra os pés, aplica escala
única, isola bordas e exporta a faixa usada pelo jogo. O prompt orienta o desenho;
não garante uma spritesheet pronta para produção.
