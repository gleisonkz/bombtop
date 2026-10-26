import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildHeadAnchors, headAnchor } from "../src/render/head-anchor";
import { SHEETS, playerFrame, type SheetLayout } from "../src/render/sprites";

const roster = Object.entries(SHEETS).filter(([, sheet]) => "stun" in sheet);
const python = `
import sys,json,base64,math
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]); result=[]
for name,s in json.load(sys.stdin):
 row=s['stun']['row']; w=s['width']; h=s['frameH']
 alpha=Image.open(root/s['url'].split('?')[0]).convert('RGBA').getchannel('A')
 strip=alpha.crop((0,row*h,w,(row+1)*h))
 bounds=[]
 for col in s['stun'].get('columns',range(s['stun']['frames'])):
  bbox=strip.crop((col*s['frameW'],0,(col+1)*s['frameW'],h)).point(lambda a:255 if a>=128 else 0).getbbox()
  if bbox: bounds.append(bbox)
 top=min(b[1] for b in bounds)
 bottom=min(h,top+max(1,math.ceil((s['anchorY']-top)/3)))
 heads=[]
 for col in s['stun'].get('columns',range(s['stun']['frames'])):
  bbox=strip.crop((col*s['frameW'],top,(col+1)*s['frameW'],bottom)).point(lambda a:255 if a>=128 else 0).getbbox()
  if bbox: heads.append(bbox)
 result.append({'name':name,'alpha':base64.b64encode(strip.tobytes()).decode(),'x':(min(b[0] for b in heads)+max(b[2] for b in heads))/2,'y':top})
print(json.dumps(result))
`;

describe("production stun head matrix", () => {
  it("matches actual PNG alpha bounds throughout every roster stun animation", () => {
    const output = execFileSync("python", ["-c", python, fileURLToPath(new URL("../public/", import.meta.url))], {
      input: JSON.stringify(roster), maxBuffer: 16 * 1024 * 1024,
    });
    const decoded: { name: string; alpha: string; x: number; y: number }[] = JSON.parse(output.toString());
    const matrix = [];
    for (const entry of decoded) {
      const sheet: SheetLayout = SHEETS[entry.name as keyof typeof SHEETS];
      const data = new Uint8ClampedArray(sheet.width * sheet.height * 4);
      const rowOffset = sheet.stun!.row * sheet.frameH * sheet.width;
      const alpha = Buffer.from(entry.alpha, "base64");
      for (let index = 0; index < alpha.length; index++) data[(rowOffset + index) * 4 + 3] = alpha[index]!;
      const anchors = buildHeadAnchors(data, sheet);
      expect(anchors.get(sheet.stun!.row), entry.name).toEqual({ x: entry.x, y: entry.y });
      const poses = Array.from({ length: sheet.stun!.frames }, (_, index) => headAnchor({ sheet, anchors,
        frame: playerFrame(sheet, { facing: "down", moving: false, carrying: false, stunned: true, tick: index * sheet.ticksPerFrame }),
        x: 100, feetY: 106 }));
      expect(new Set(poses.map((pose) => `${pose.x},${pose.headY}`)).size, entry.name).toBe(1);
      expect(poses[0]!.headY, entry.name).toBeCloseTo(106 + (entry.y - sheet.anchorY) * (sheet.scale ?? 1));
      matrix.push({ name: entry.name, x: +poses[0]!.x.toFixed(2), headY: +poses[0]!.headY.toFixed(2),
        oldHeadY: +(106 - sheet.bodyH * (sheet.scale ?? 1)).toFixed(2) });
    }
    console.table(matrix);
  });
});
