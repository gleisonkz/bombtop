# Special palette visual validation — 2026-10-25

Scope correction: the user subsequently specified that selected colors must
apply only to the special preview on `/personagens`. Global gameplay palette
application is disabled by default again. The current validation and actual
page captures are in `CHARACTER-PAGE-COLOR-VALIDATION.md`; this document records
the earlier diagnostic run, not the current gameplay behavior.

Root: `D:/Programação/Jogos/New folder/bombtop`.
Actual browser: Codex Browser Bridge, task-owned tab1410196218,
`http://localhost:5173/special-colors-visual-qa.html`.
Temporary page used the current `createMatch`, `step`, `publicView`, `Renderer`
and production artwork. Each arena contained two identical characters, casting
simultaneously in separate corridors. No alternate effect implementation was
used. The diagnostic page/tab were removed and the shared browser lease released.

## Discovered and corrected

The white selection already means original character artwork in `paintSheet`.
`specialEffectColor` still treated it as a white recolor. Before correction,
switching explicit `ownColors` to white changed 330 rendered pixels for Goku,
816 for Pikachu, 783 for Static and76 for Captain in the sampled first matrix.
Added a failing unit regression, then aligned white with original effect identity.
Original ownership still overrides every seat color. Black/red/blue/green remain
distinct alternatives. No source artwork was rewritten.

## Runtime evidence

- `special-colors-qa.png`: Goku, Pikachu, Static and Captain; original above,
  red below. Actual GPU stage images assembled into a labeled evidence grid.
- `special-colors-secondary-qa.png`: Naruto, Harry, Optimus and Bomber, same
  original/red arrangement. Covers Rasengan, Patronus, truck and mega bomb.
- Both players cast through normal shared simulation inputs. Observed animation
  playback advanced the first grid from ticks44/24/24/24 to47/27/27/27. The tab
  remained in background; this is playback evidence, not a foreground FPS test.

Compared ticks1,4,8,12,20,24,32,40,44,52,80,100. For the first four characters,
the original corridor had zero pixel differences between explicit original
ownership and the white selection at all12 sampled phases. Changing only the
other player's palette never changed the original corridor.

| Character | Blue → black/red/green changed pixels in alternate corridor | Changed original corridor pixels | Blue restored differences |
| --- | ---: | ---: | ---: |
| Goku | 1435 /1435 /1435 | 0 | 0 |
| Pikachu | 2981 /2981 /2981 | 0 | 0 |
| Static | 3265 /3266 /3266 | 0 | 0 |
| Captain | 698 /698 /698 | 0 | 0 |

Also rendered red and blue simultaneously. Changing the original corridor to red
changed1434/3148/3285/698 pixels respectively, while the blue corridor changed0.
Restoring the original choice restored the authored effects.

The second group likewise changed only the alternate corridor for black/red/green:
Naruto302/302/301 pixels, Harry377/377/377, Optimus711/711/711,
Bomber744/745/743. Original corridor changes during these palette switches:0.
Restoring blue:0 changed pixels for all four.

For moving characters, repeated draws at one tick were stabilized before the
original-effect comparison. Character body sprites were excluded from that
specific comparison because the white-body canvas read/write path can differ
slightly at antialiased edges from the untouched-original source. The effects
themselves—including the truck and mega bomb—had zero differences across all12
phases for each second-group character. Complete bodies remain visible in both
saved evidence grids and were visually inspected. No claim of bit-identical
body AA for those two source paths is made.

No color leak or stale pooled effect texture remained. Bright cores, black
outlines, alpha, animation geometry and layering stayed intact.

## Validation and scope

113 focused tests across8 files passed; production build passed; focused diff
check passed. A full concurrent workspace run reported869 passing and6 failing
tests, all in `kick-stop-controls.test.ts` from ongoing control work. The final
typecheck reported two concurrent `score-portrait.test.ts` object-shape errors
(`box` absent from the current target type). Those unrelated files were preserved.

This validates eight representative special families and all four alternate
palette choices in the current local game renderer, rather than every gameplay
interaction or remote deployment. Generic stun/cocoon/charm victim status art
remains neutral under the existing protocol without caster identity.
