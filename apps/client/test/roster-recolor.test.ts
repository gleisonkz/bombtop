import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paintSheet, SHEETS, type SheetLayout } from "../src/render/sprites";
import { CHARACTER_SHEETS, characterMoves } from "../src/ui/sheet-art";
import { PLAYER_COLORS } from "../src/ui/art";

const variants = PLAYER_COLORS.slice(1).map(color => [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number]);
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const layouts: [string, SheetLayout][] = [["bomb gameplay", SHEETS.bomber], ...Object.entries(CHARACTER_SHEETS).flatMap(([name, sheet]) => [
  [name, sheet] as [string, SheetLayout],
  ...characterMoves(sheet).flatMap(move => move.sheet ? [[`${name} ${move.label}`, move.sheet] as [string, SheetLayout]] : []),
])];

const readSamples = `
import json, sys
from pathlib import Path
from PIL import Image
import numpy as np
s = json.load(sys.stdin)
im = Image.open(Path(sys.argv[1]) / s['url'].split('?')[0]).convert('RGBA')
assert im.size == (s['width'], s['height']), 'sprite layout mismatch'
a = np.asarray(im)
fw, fh = s['frameW'], s['frameH']
result = []
for row in range(s['height']//fh):
    for column in range(s['width']//fw):
        frame = a[row*fh:(row+1)*fh,column*fw:(column+1)*fw]
        opaque = frame[:,:,3] > 0
        if not opaque.any(): continue
        rgb=frame[:,:,:3].astype(float)/255
        r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
        high=rgb.max(axis=2); low=rgb.min(axis=2); delta=high-low
        safe=np.where(delta==0,1,delta)
        h=np.where(high==r,((g-b)/safe+6)%6,np.where(high==g,(b-r)/safe+2,(r-g)/safe+4))*60
        denominator=1-np.abs(high+low-1)
        saturation=np.divide(delta,denominator,out=np.zeros_like(delta),where=denominator!=0)
        lo,hi=s.get('hues',[0,-1])
        hue=((h>=lo)&(h<=hi)) if lo<=hi else ((h>=lo)|(h<=hi))
        dye=(saturation>=.2)&hue&opaque
        for clothing in s.get('clothes',[]): dye |= np.all(frame[:,:,:3]==clothing,axis=2)&opaque
        protected=np.zeros((fh,fw),dtype=bool)
        p=s.get('colorProtection')
        if p and row<len(p['rows']) and column<len(p['rows'][row]):
            xs=(np.arange(fw)+.5)*p['frameW']/fw; ys=(np.arange(fh)+.5)*p['frameH']/fh
            for b in p['rows'][row][column] or []:
                protected |= ((ys[:,None]>=b['top'])&(ys[:,None]<b['bottom'])&(xs[None,:]>=b['left'])&(xs[None,:]<b['right']))
        groups={'clothes':dye&~protected,'protected':dye&protected,'fixed':opaque&~dye,'transparent':~opaque}
        for kind,mask in groups.items():
            yy,xx=np.nonzero(mask)
            if len(xx):
                for point in sorted(set([0,len(xx)//2,len(xx)-1])):
                    y,x=int(yy[point]),int(xx[point])
                    result.append(dict(row=row,column=column,x=x,y=y,kind=kind,rgba=list(map(int,frame[y,x]))))
print(json.dumps(result))
`;

type Sample = { row: number; column: number; x: number; y: number; kind: "clothes" | "protected" | "fixed" | "transparent"; rgba: number[] };

describe("production roster color variants", () => {
  it.each(layouts)("applies every alternate color across %s frames and preserves protected pixels", (name, sheet) => {
    const samples: Sample[] = JSON.parse(execFileSync("python", ["-c", readSamples, publicRoot], {
      input: JSON.stringify(sheet), encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
    }));
    const dyeable = samples.filter(sample => sample.kind === "clothes");
    expect(dyeable.length).toBeGreaterThan(0);
    for (let row = 0; row < sheet.height / sheet.frameH; row++) {
      const batch = samples.filter(sample => sample.row === row);
      if (!batch.length) continue;
      const original = new Uint8ClampedArray(sheet.width * sheet.frameH * 4);
      const offset = (sample: Sample) => (sample.y * sheet.width + sample.column * sheet.frameW + sample.x) * 4;
      for (const sample of batch) original.set(sample.rgba, offset(sample));
      for (const color of [...variants, [245, 245, 245] as [number, number, number]]) {
        const pixels = original.slice();
        paintSheet(pixels, sheet, color, row);
        const changed = new Set<number>();
        for (const sample of batch) {
          const index = offset(sample);
          const actual = [...pixels.slice(index, index + 4)];
          const context = `${name} row=${row} col=${sample.column} ${sample.kind} color=${color}`;
          expect(actual[3], context).toBe(sample.rgba[3]);
          if (sample.kind !== "clothes" || color[0] === 245) expect(actual, context).toEqual(sample.rgba);
          else if (actual.some((value, channel) => value !== sample.rgba[channel])) changed.add(sample.column);
        }
        if (color[0] !== 245) {
          for (const column of new Set(batch.filter(sample => sample.kind === "clothes").map(sample => sample.column))) {
            expect(changed.has(column), `${name} row=${row} col=${column} color=${color}`).toBe(true);
          }
        }
      }
    }
  }, 30000);
});
