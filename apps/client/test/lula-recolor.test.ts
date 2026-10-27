import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";

type PixelSample = {
  row: number;
  column: number;
  x: number;
  y: number;
  kind: "face" | "shirt" | "star" | "transparent";
  rgba: number[];
};

const samplePng = `
import colorsys, hashlib, json, sys
from pathlib import Path
from PIL import Image

spec = json.load(sys.stdin)
source = Path(sys.argv[1]) / spec['url'].split('?')[0]
assert hashlib.sha256(source.read_bytes()).hexdigest() == spec['colorProtection']['sourceSha256'], 'stale Lula protection'
image = Image.open(source).convert('RGBA')
assert image.size == (spec['width'], spec['height'])
fw, fh = spec['frameW'], spec['frameH']
counts = [4,4,4,6,6,6,6,7,9,9,9,4,4,4,6,6,6,8]
samples = []
for row, count in enumerate(counts):
    for column in range(count):
        frame = image.crop((column*fw,row*fh,(column+1)*fw,(row+1)*fh))
        assert frame.getchannel('A').getbbox(), (row,column,'empty occupied cell')
        groups = dict(face=[],shirt=[],star=[],transparent=[])
        regions = spec['colorProtection']['rows'][row][column]
        assert regions, (row,column,'missing head protection')
        for y in range(fh):
            for x in range(fw):
                rgba = frame.getpixel((x,y))
                if rgba[3] == 0:
                    if not groups['transparent']:
                        groups['transparent'].append((x,y,rgba))
                    continue
                h,l,s = colorsys.rgb_to_hls(*(v/255 for v in rgba[:3]))
                protected = any(b['left'] <= x < b['right'] and b['top'] <= y < b['bottom'] for b in regions)
                if s >= .2 and (h*360 >= 336 or h*360 <= 6):
                    groups['face' if protected else 'shirt'].append((x,y,rgba))
                elif 35 <= h*360 <= 65 and s >= .6 and l >= .3:
                    groups['star'].append((x,y,rgba))
        assert groups['shirt'], (row,column,'no actual dyeable shirt red')
        assert groups['transparent'], (row,column,'no transparent margin')
        if row not in (2,5,10,13,16):
            assert groups['face'], (row,column,'no actual protected face red')
        # Every vulnerable facial red is retained, including collapsed death
        # heads near the cell bottom. Other categories need only real witnesses.
        for kind, points in groups.items():
            chosen = points if kind == 'face' else points[:1]
            for x,y,rgba in chosen:
                samples.append(dict(row=row,column=column,x=x,y=y,kind=kind,rgba=rgba))
print(json.dumps(samples))
`;

describe("Lula actual PNG recoloring", () => {
  let samples: PixelSample[];

  beforeAll(() => {
    const sheet: SheetLayout = SHEETS.lula;
    expect(sheet.frameW).toBe(192);
    expect(sheet.frameH).toBe(192);
    expect(sheet.colorProtection).toBeDefined();
    samples = JSON.parse(execFileSync("python", ["-c", samplePng,
      fileURLToPath(new URL("../public/", import.meta.url))], {
      input: JSON.stringify(sheet), encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    }));
    const occupied = new Set(samples.map(({ row, column }) => `${row}/${column}`));
    expect(occupied.size).toBe(108);
    expect(samples.some(({ kind }) => kind === "star")).toBe(true);
    for (const column of [4, 5, 6]) {
      expect(samples.some((sample) => sample.row === 7 && sample.column === column
        && sample.kind === "face" && sample.y > 120)).toBe(true);
    }
  }, 30_000);

  it.each([false, true])("preserves face, yellow star and alpha; changes shirt (cropped=%s)", (cropped) => {
    const sheet = SHEETS.lula;
    for (const target of [[40, 180, 80], [40, 80, 210]] as const) {
      const batches = cropped ? Array.from({ length: 18 }, (_, row) => row) : [0];
      for (const firstRow of batches) {
        const batch = cropped ? samples.filter(({ row }) => row === firstRow) : samples;
        const pixels = new Uint8ClampedArray(sheet.width * (cropped ? sheet.frameH : sheet.height) * 4);
        const offset = (sample: PixelSample) => (
          ((cropped ? 0 : sample.row * sheet.frameH) + sample.y) * sheet.width
          + sample.column * sheet.frameW + sample.x
        ) * 4;
        for (const sample of batch) pixels.set(sample.rgba, offset(sample));
        paintSheet(pixels, sheet, target, firstRow);
        for (const sample of batch) {
          const index = offset(sample);
          const actual = [...pixels.slice(index, index + 4)];
          const context = `${sample.kind} row=${sample.row} column=${sample.column} x=${sample.x} y=${sample.y}`;
          expect(actual[3], context).toBe(sample.rgba[3]);
          if (sample.kind === "shirt") {
            expect(actual.slice(0, 3), context).not.toEqual(sample.rgba.slice(0, 3));
            const dominant = target[1] > target[2] ? 1 : 2;
            expect(actual[dominant], context).toBeGreaterThan(actual[0]!);
          } else {
            expect(actual, context).toEqual(sample.rgba);
          }
        }
      }
    }
  }, 30_000);
});
