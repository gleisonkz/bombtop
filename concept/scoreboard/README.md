# Scoreboard portraits

All 18 production characters have reviewed anatomical regions in `apps/client/src/render/score-portraits.json`, bound to the actual atlas URL and native frame dimensions. Coordinates refer to the first front-idle cell; playback column and row offsets are applied at load time. Alpha-tight bounds remove empty padding. Optional polygon clips remove cape, shoulders, scarf or weapon pixels while preserving reviewed face/ear/helmet/beard details.

The default head box is 13×13 world pixels, with chin baseline y=14.5 in the 16-pixel top wall. Reviewed optical allowances compensate for accessory-heavy silhouettes: Goku fits 15.5×13 (about 19% larger), and Bugs fits 13×15 with baseline y=15.5 (about 15% larger). Hair and ear tips remain intact. Wider portraits shift left so the score-number gap remains at least 1.5 pixels and they stay inside their 28-pixel slot. Naruto's crop includes the chin and upper neck/collar. The heads are never stretched to different aspect ratios.

Portraits copy the player's repainted pixels into isolated clamped textures. Their cache belongs to the loaded skin and color; evicting a large painted animation sheet cannot invalidate the small scoreboard portrait.

`portrait-review.png` is a captured review matrix built from the production Renderer portraits, with a real five-seat score-slot arrangement beneath it. The outlines and matrix labels are QA aids and do not appear in the game.

Validate with `python apps/client/scripts/test-score-portraits.py` and the client `score-portrait`, `score-bar` and scoreboard lifecycle tests in `ground-effects.test.ts`. Re-review profiles whenever character artwork changes, including replacements with unchanged cell dimensions.
