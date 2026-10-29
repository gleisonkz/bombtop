# Native game electrical FX and fluid Flash

User rejected detailed character-sprite-reference VFX as unlike actual Thor effects. New image_gen references are extracted actual Thor beam/impact and older Pikachu/magnet/speed effects ONLY. Raw RGBA generations, exact prompts and native-scale proofs archived here. pack.py registers real alpha cores, drops invisible low-alpha RGB fringes, exports64pxcells and shared6color palettes. No character sprites modified.

Pikachu32distinctdrawings:8beam/8impact/8back/8front. Static40:8beam/8impact/8coil/8back/8front. Flash24:8beam/8impact/8speedstrips. New sequences play8phases at2simulationticks,30fps. Legacy fallbacks preserve prior timings. Allgeometry/gameplayreach/expiry unchanged. ExistingThor andothercharacter effects remain separate.

Flash energy uses dedicated speedForce textures. Streaks advance4worldpixels per tick alongpath, alternateanimatedphases, fadeout stationaryorigin over12ticks and strengthen towardarrival. Position updates60tickspersecond; actualspritephase30fps. No gameplayteleport/dash rules changed.

Bounded code/test patches andall3PNGs delivered to actual5173checkout.36focusedtests plus typecheck passed in both roots; sourcebuild passed with existing largechunkwarning. LiveBridge scene showed newPika/Static nexttoThor; Flash structuredlivecheck confirmed6energy and7streak sprites at earlydashframe; secondFlashcapture was detached, no further retries.
