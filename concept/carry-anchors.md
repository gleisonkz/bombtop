# Carried bomb attachment

The renderer uses palm sockets measured on the final packed character cells, rather than a standing-height estimate. `apps/client/src/render/carry-anchors.json` contains 540 sockets for the 18 production characters: three views, four idle frames and six walking frames. Side sockets track the visible palm; front/back sockets include the distance between the palms.

Rebuild with `python apps/client/scripts/build-carry-anchors.py`. Validate with `python apps/client/scripts/build-carry-anchors.py --check` and `python apps/client/scripts/test-carry-anchors.py`. The generator records manually inspected seeds, bounded image matching, reviewed ambiguities and corrected reference poses. It never modifies sprite artwork. Rebuild and inspect the sockets whenever the character atlas changes.

Runtime applies the same feet anchor, frame, scale, horizontal mirror and interpolated position as the character. The held sphere fits the palms and compensates for the fuse pulse. Side views support its lower near corner. Hands and face normally render in front of the sphere; Captain's legacy baked bomb is covered by the live bomb. Ground bombs retain their existing size and placement.

Naruto's final front carry-walk cell loses both palms. Its playback columns are `[0,1,2,3,4,0]`, so both character rendering and socket lookup use a valid settling pose. The source-cell sleeve fallback remains documented by the generator but is not played.

TypeScript regressions: `apps/client/test/carried-bomb.test.ts`. Live validation inspected all four directions and checked opaque bomb pixels at 8,640 transformed palm contacts across 5,760 poses, covering all production characters, idle/walk, normal/piercing/remote/mega bombs and two fuse stages.
