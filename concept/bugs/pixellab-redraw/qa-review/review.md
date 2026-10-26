# Immutable visual QA

Candidate: bugs-candidate.png, 1728x3456, 9x18 cells of 192px; 108 occupied poses per supplied inventory.
SHA-256: fa08ec27f4def52e885aa5457e23f1dc66e904d409e61caaa740cc2fb5f639cf
Reference inspected: ../pixellab-preview/option-1.png (actual pixels).
All coordinates below are zero-based packed row/column, not raw source filenames.

## Material blockers

1. Palm metadata is not visually accepted as palm support placement. In palm-review.png, 14/3, 14/4, 14/5 and 16/2..5 put magenta points at the raised thumb tips/inner upper protrusions, rather than on the central upward-facing palm surface. The corresponding unmarked enlarged crops show the thumb clearly. Several side-view markers likewise select the highest fingertip edge (12/0, 15/4), so selecting white pixels alone does not establish an object support socket. If these points drive carried-object placement, review/correct them using the intended object's contact geometry and rendered overlay. Static inspection establishes misplaced palm labels; it does not establish runtime bomb clipping. Candidate pixels need not be changed for this metadata issue.

2. Rear-view ear surface consistency needs correction or explicit art acceptance: carryWalk-north 16/1..5 exposes bright pink inner-ear panels, whereas carryIdle-north 13/0..3 and 16/0 show gray ear backs. The head remains rear-facing, with no frontal eyes/nose/mouth. Evidence: bounded-crops.png 13/2 versus 16/2 and 16/4; palm-review.png shows the entire sequence. This is a directional ear-art inconsistency, not a claim that a full front face appears.

## Accepted within requested static scope

- Identity: slender torso, long limbs/ears, gray/white palette, muzzle, teeth and blue neck detail remain consistent with approved actual reference. No material squat-chest/baby-face drift identified. Lobby 17/6 crouches with bent knees; that single pose does not establish a permanently squat redesign.
- No baked bomb, sphere, carrot or detached effect found in carry rows 11..16, north cast 10 or lobby 17. White rear oval is the attached rabbit tail; side muzzle/glove shapes are not props.
- North cast row 10 remains rear or rear three-quarter. White cheek edges at 10/4..8 do not show frontal eyes or mouth.
- No visible cell-edge clipping of ears/gloves or clearly detached limbs in the reviewed rows. The dark rectangular feet at 16/4 remain attached to the legs; their stylization is conspicuous but not a detached-limb finding.

## Evidence and limits

Inspected approved image, sheet-review.png, front-review.png, directions-review.png, palm-review.png and 12 selected cells enlarged 2x with nearest-neighbor in bounded-crops.png. Carry rows were reviewed in full in palm-review; north cast/lobby in review sheets and selected enlarged crops. No motion smoothness, timing, contact stability, runtime registration or actual carried-object rendering is claimed. No production assets, candidate pixels, metadata or scripts were edited. Only qa-review evidence/report files were created.
