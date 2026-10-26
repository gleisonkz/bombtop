# Web cocoon

The active runtime asset is `apps/client/public/sprites/web-effects-pixel-v2.png`: a 256 × 192 RGBA atlas, four columns and three rows of 64 × 64 cells, redrawn at native resolution rather than enlarged. Row 0: cocoon struggle; row 1: web projectile facing right; row 2: expanding terminal web. All four frames in each row differ. Previous atlases remain unused references.

Shared silk palette: `#596e8c`, `#a8afb9`, `#c5c8cd`, `#e0e1e3`, `#f5f4ed`; light from top left, curved ribbons, fine cross fibers, darker overlaps and small warm silk highlights. Opaque pixel clusters preserve transparent gaps and nearest sampling. The cocoon uses a bottom-center anchor and integer coordinates, changing frames every six ticks without continuous rotation. Release expands and fades in steps over the last second.

The shot preserves the existing 20-tick hand-thrust delay, travels during ages 20–27, and opens at its endpoint during ages 28–35, two ticks per frame. The terminal web also appears on misses; it does not claim an authoritative hit. Gameplay still applies the trap immediately. Procedural effects remain load-failure fallbacks.

This is the pixel-effect convention for this web family, not a migration of unrelated effects. Follow the PixiJS 8 texture-source and atlas framing model: https://pixijs.com/8.x/guides/components/textures . One shared nearest-sampled source supplies all twelve cells without per-frame canvas work.
