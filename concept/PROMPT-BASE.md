# Prompt-base — família Bombtop v1

Para integrar personagens, especiais, sons e telas, seguir o roteiro operacional de [CHARACTER-RECIPE.md](CHARACTER-RECIPE.md). A identidade e o acabamento aprovados abaixo governam o visual; os contratos de grade e as animações devem ser definidos para cada entrega.

Fonte normativa: [identidade](CHARACTER-IDENTITY.md) e [contrato JSON](characters.identity.json). Anexar a imagem real [menu aprovado do Bomber](bomber/menu-flight-source.png) pelo mecanismo de referência/edição da ferramenta. Para personagens novos, anexar também seu conceito aprovado quando existir.

## Variáveis

- CHARACTER: nome e arquétipo original.
- IDENTITY: cabeça/olhos, roupa, materiais, paleta, emblema, acessórios.
- PERSONALITY: expressão e atitude.
- DELIVERABLE: conceito isolado, quadros de uma ação, ou folha de produção com inventário explícito.
- GRID: dimensões, células, direções, número de quadros, margens e âncoras do contrato aprovado. Não pedir folha de animação sem esse bloco.

## A. Descrição do PixelLab (`create_character`)

Use the attached approved Bombtop Bomber menu-flight artwork as the actual visual reference for FAMILY STYLE and rendering quality. Create original character [CHARACTER], with [IDENTITY] and [PERSONALITY]. Do not transfer Bomber-specific bomb head, amber eyes, burning wick, violet armor, red cape or gold hexagonal chest emblem to other characters unless explicitly requested in their identity.

Premium smoothly shaded 2D arcade illustration, compact rounded action-toy proportions: oversized head, short sturdy legs, compact torso, rounded shoulders, large rounded gloves and chunky boots. Neutral standing head height is approximately 40–45 percent of body height excluding flame and extended accessories; allow pose foreshortening without changing anatomy. Preserve the approved model across front, right and back views.

Continuous darker outer outlines, thinner clean inner separations, crisp antialiased curves. Smooth controlled gradients and clean highlights matching the attached approved image. Upper-left/front key light; polished shell, satin armor and softer cloth folds retain distinct material responses. Saturated curated color and readable small-scale silhouette. No pixel-art look. Do not flatten the approved rendering into a two- or three-value-only treatment.

Deliver [DELIVERABLE] using [GRID]. True transparent RGBA, isolated complete poses, stable registered anchors and generous transparent margins. No scene, floor shadow, text, banners, watermark, baked checkerboard, matte, stray fragments, neighboring-frame contamination, clipped accessories, extra limbs or copied franchise costume. Real newly drawn action changes in every intended animation frame; no identical repeats disguised as animation and no fake upscale of old art.

## Identidade Bomber pronta para uso

CHARACTER: Bomber. IDENTITY: spherical black bomb head, two inward-slanted glowing amber slit eyes with pale cores, short lit wick with gold collar and yellow/orange flame, deep violet armor, red armored gloves, flowing red cape, chunky violet boots with gold trim, small original gold hexagonal chest emblem. Back views show only rear shell and cape, without front eyes/chest emblem. Carried bombs remain renderer-owned; carry poses hold both arms raised without a baked-in bomb.

## Grade refinada

Master: células 208 × 288, 9 colunas × 19 linhas, total 1872 × 5472; âncora (104, 280), corpo nominal 200 px. Gameplay runtime: células 104 × 144, 9 × 18, total 936 × 2592; âncora (52, 140), corpo 100 px, escala 0,22. Recortar e reduzir cada quadro master separadamente com Lanczos antes de montar o runtime; não reduzir a folha inteira. Consultar inventário por linha no JSON. Linha 18 do master é inventário do voo, excluída do gameplay.

Menu aprovado permanece em 1152 × 1152, 3 × 3 células de 384; runtime em 768 × 768, células de 256, mesmas nove poses. A grade especifica produção, não prova conclusão: validar o resultado real antes de integrar.

## Histórico v0.1

O piloto textual Bombtop Vanguard e o cartão histórico exploravam proporções. A referência aprovada atual governa o acabamento v1; as antigas restrições de sombreamento em dois/três valores deixam de valer. Preservar somente a intenção de personagens originais compactos e coerentes.
