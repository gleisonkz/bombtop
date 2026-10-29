# Pikachu and Donatello VFX remakes

User confirmed VFX sprites only, matching actual Thor/Captain and the new Static effects. Built-in image_gen generated both families using actual game sprites and effect atlas references. Exact prompts, original RGBA sources and reproducible pack.py archived here.

Pikachu:16distinctdrawings, native128cells4x4,16colorpalette,binaryalpha. Rows beam,impact,backaura,frontaura. New thunder texture selection leaves shared shock (Flash), Thor lightning and Static magnetic effects unchanged.4phases at3ticksperframe, reach/duration unchanged.

Donatello:8distinctwhooshdrawings, native128cells8x1,12colorpalette,binaryalpha. Center/ellipse registered from alpha cores. No character or staff baked into the effect.8phases at3ticks preserve24tickloop. Separate spin method retains primitivecircle fallback if optional art is unavailable. Existingcharacter animation still supplies the actual staff. Other companion effects unchanged.

Production pikachu-special-detailed.png and donatello-spin-detailed.png. Both source and actual5173checkout receive only bounded integration patches; character images are untouched.
