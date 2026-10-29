import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSheet, playerFrame, SHEETS, type LobbyImage } from "../src/render/sprites";
import anchors from "../src/render/carry-anchors.json";
import { CHARACTER_SHEETS, characterMoves, previewPose } from "../src/ui/sheet-art";

const approved = new URL("../../../concept/penelope/pixellab-redraw/", import.meta.url);
const publicRoot = new URL("../public/", import.meta.url);
const sheet = SHEETS.penelope;
const rows = [11, 12, 13, 14, 15, 16];
const counts = [4, 4, 4, 6, 6, 6];

function metadata(): Pick<LobbyImage, "anchorX" | "anchorY"> & {
  bodyH: number;
  scale: number;
  lobby: Pick<LobbyImage, "anchorX" | "anchorY">;
  victory: Pick<LobbyImage, "anchorX" | "anchorY">;
  sha256: Record<"gameplay" | "lobby" | "victory", string>;
} {
  return JSON.parse(readFileSync(new URL("runtime-metadata.json", approved), "utf8"));
}

describe("approved Penelope redraw integration", () => {
  it.each([
    ["penelope", 1728, 3264],
    ["penelope-lobby", 3072, 192],
    ["penelope-victory", 3072, 192],
  ] as const)("serves the exact approved %s PNG", (name, width, height) => {
    const candidate = readFileSync(new URL(`${name}-candidate.png`, approved));
    const promoted = readFileSync(new URL(`sprites/${name}.png`, publicRoot));
    expect(createHash("sha256").update(promoted).digest("hex"))
      .toBe(createHash("sha256").update(candidate).digest("hex"));
    expect([promoted.readUInt32BE(16), promoted.readUInt32BE(20)]).toEqual([width, height]);
  });

  it("registers the native grid, measured anchor and complete gameplay strips", () => {
    expect(sheet).toMatchObject({ width: 1728, height: 3264, frameW: 192, frameH: 192 });
    expect(sheet.height / sheet.frameH).toBe(17);
    const measured = metadata();
    for (const key of ["anchorX", "anchorY", "bodyH", "scale"] as const) {
      expect(measured[key], key).toBeGreaterThan(0);
      expect(sheet[key], key).toBe(measured[key]);
    }
    expect(sheet.death).toMatchObject({ row: 7, frames: 5 });
    for (const [index, view] of (["down", "side", "up"] as const).entries()) {
      expect(sheet.cast[view]).toEqual({ row: 8 + index, frames: 9 });
      expect(sheet.carryIdle[view]).toEqual({ row: 11 + index, frames: 4 });
      expect(sheet.carryWalk[view]).toEqual({ row: 14 + index, frames: 6 });
      const facing = view === "side" ? "right" : view;
      for (const moving of [false, true]) {
        const strip = (moving ? sheet.carryWalk : sheet.carryIdle)[view];
        const cadence = moving ? sheet.ticksPerFrame : sheet.idleTicksPerFrame;
        for (let col = 0; col < strip.frames; col++) {
          expect(playerFrame(sheet, { facing, moving, carrying: true, tick: col * cadence }))
            .toMatchObject({ x: col * 192, y: strip.row * 192 });
        }
      }
    }
  });

  it.each([["walk", "lobby", "Na sala"], ["win", "victory", "Vitória"]] as const)(
    "uses the new override for %s previews and the guide", (state, kind, label) => {
      expect(CHARACTER_SHEETS.penelope).toBe(sheet);
      const pose = previewPose(CHARACTER_SHEETS.penelope, state);
      const measured = metadata()[kind];
      expect(measured.anchorX).toBeGreaterThan(0);
      expect(measured.anchorY).toBeGreaterThan(0);
      const image = {
        url: `sprites/penelope-${kind}.png?v=base3-${metadata().sha256[kind].slice(0, 8)}`, width: 3072, height: 192,
        frameW: 192, frameH: 192, anchorX: measured.anchorX, anchorY: measured.anchorY,
      };
      expect(sheet[kind]).toMatchObject({ row: 0, frames: 16, image });
      expect(pose).toMatchObject({ row: 0, frames: 16, sheet: image });
      expect(characterMoves(sheet).find(move => move.label === label))
        .toMatchObject({ row: 0, frames: 16, sheet: image });
    },
  );

  it("matches all 30 native carry sockets to 50 visible white glove points", () => {
    const profile = anchors.characters.penelope;
    expect(profile).toMatchObject({ frameW: 192, frameH: 192 });
    expect(Object.keys(profile.rows)).toEqual(rows.map(String));
    const inspect = `
import json,sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]); profile=json.load(sys.stdin)
palms=json.loads((root/'palms.json').read_text(encoding='utf-8'))
assert (palms['frameW'],palms['frameH']) == (192,192)
assert set(palms['rows']) == {str(r) for r in range(11,17)}
image=Image.open(sys.argv[2]).convert('RGBA')
result=[]
for row,count in zip(range(11,17),(4,4,4,6,6,6)):
 frames=palms['rows'][str(row)]
 assert len(frames)==count
 for col,points in enumerate(frames):
  assert len(points)==(1 if row in (12,15) else 2)
  socket=profile['rows'][str(row)][col]
  x=sum(p[0] for p in points)/len(points); y=sum(p[1] for p in points)/len(points)
  span=0 if len(points)==1 else abs(points[1][0]-points[0][0])
  for key,value in [('x',x),('y',y),('span',span)]:
   assert abs(socket[key]-value)<=0.0011, (row,col,key,socket[key],value)
  for x,y in points:
   assert 0<=x<192 and 0<=y<192
   rgba=image.getpixel((col*192+int(x),row*192+int(y)))
   result.append({'row':row,'col':col,'rgba':rgba})
print(json.dumps(result))
`;
    for (const [index, row] of rows.entries()) {
      expect(profile.rows[String(row) as keyof typeof profile.rows]).toHaveLength(counts[index]!);
    }
    const points: { row: number; col: number; rgba: number[] }[] = JSON.parse(execFileSync("python", [
      "-c", inspect, fileURLToPath(approved), fileURLToPath(new URL("sprites/penelope.png", publicRoot)),
    ], { input: JSON.stringify(profile), encoding: "utf8", timeout: 15000 }));
    expect(points).toHaveLength(50);
    for (const { row, col, rgba } of points) {
      expect(rgba[3], `glove alpha ${row}:${col}`).toBeGreaterThan(128);
      expect(Math.min(...rgba.slice(0, 3)), `white glove ${row}:${col}`).toBeGreaterThan(140);
      expect(Math.max(...rgba.slice(0, 3)) - Math.min(...rgba.slice(0, 3))).toBeLessThan(65);
    }
  });

  it.each(["idle", "walk", "win"] as const)("preserves real whites, blue eyes and alpha when recoloring %s", state => {
    const layout = previewPose(sheet, state).sheet ?? sheet;
    const raw = execFileSync("python", ["-c", `
from PIL import Image
import sys
image=Image.open(sys.argv[1]).convert('RGBA')
sys.stdout.buffer.write(image.crop((0,0,image.width,192)).tobytes())
`, fileURLToPath(new URL(layout.url.split("?")[0]!, publicRoot))], { maxBuffer: 4 * 1024 * 1024, timeout: 15000 });
    const pixels = new Uint8ClampedArray(raw);
    paintSheet(pixels, layout, [40, 190, 80]);
    let whites = 0;
    let eyes = 0;
    let changed = 0;
    let alphaChanges = 0;
    const preservedFailures: number[] = [];
    for (let offset = 0; offset < raw.length; offset += 4) {
      const r = raw[offset]!; const g = raw[offset + 1]!; const b = raw[offset + 2]!;
      if (pixels[offset + 3] !== raw[offset + 3]) alphaChanges++;
      if (raw[offset + 3]! < 128) continue;
      // Neutral whites stay fixed. Rose-tinted highlights are intentionally
      // part of the uniform palette and must follow the player's color.
      const white = r > 180 && r === g && g === b;
      const blue = b > r + 35 && b > g + 10;
      const recolored = pixels[offset] !== r || pixels[offset + 1] !== g || pixels[offset + 2] !== b;
      if (white || blue) {
        if (recolored) preservedFailures.push(offset);
        if (white) whites++;
        if (blue) eyes++;
      }
      if (recolored) changed++;
    }
    expect(alphaChanges).toBe(0);
    expect(preservedFailures).toEqual([]);
    expect(whites).toBeGreaterThan(0);
    expect(eyes).toBeGreaterThan(0);
    expect(changed).toBeGreaterThan(0);
  });
});
