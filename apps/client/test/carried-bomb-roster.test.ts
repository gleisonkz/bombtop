import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FUSE_TICKS } from "@bombtop/shared";
import { carriedBombPose } from "../src/render/carried-bomb";
import { BOMBS, SHEETS, bombLook, playerFrame, type SheetLayout } from "../src/render/sprites";

const python = `
import sys,json
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]); result={}
for name,s in json.load(sys.stdin):
 image=Image.open(root/s['url'].split('?')[0]).convert('RGBA').getchannel('A').point(lambda a:255 if a>=128 else 0)
 w=s['frameW']; h=s['frameH']; rows={}; idle={}
 for view,strip in s['idle'].items():
  idle[view]=min(image.crop((col*w,strip['row']*h,(col+1)*w,(strip['row']+1)*h)).getbbox()[1] for col in range(strip['frames']))
 for row,count in [(11,4),(12,4),(13,4),(14,6),(15,6),(16,6)]:
  tops=[]
  for col in range(count):
   left=round(s['anchorX']-s['bodyH']/8); right=round(s['anchorX']+s['bodyH']/8)
   bbox=image.crop((col*w+left,row*h,col*w+right,(row+1)*h)).getbbox()
   tops.append(bbox[1])
  rows[str(row)]=tops
 result[name]={'idle':idle,'rows':rows}
print(json.dumps(result))
`;

describe("held bomb clearance against production artwork", () => {
  it("clears the actual head silhouette in every clean carry cell, including mirrored poses", () => {
    const roster = Object.entries(SHEETS).filter(([name]) => name !== "captain");
    const output = execFileSync("python", ["-c", python, fileURLToPath(new URL("../public/", import.meta.url))], {
      input: JSON.stringify(roster),
    });
    const measured: Record<string, { idle: Record<string, number>; rows: Record<string, number[]> }> = JSON.parse(output.toString());
    for (const [name, layout] of roster) {
      const sheet: SheetLayout = layout;
      const scale = sheet.scale ?? 1;
      for (const moving of [false, true]) for (const facing of ["down", "up", "left", "right"] as const) {
        const view = facing === "left" || facing === "right" ? "side" : facing;
        const strip = (moving ? sheet.carryWalk! : sheet.carryIdle!)[view];
        const top = Math.min(measured[name]!.idle[view]!, ...measured[name]!.rows[String(strip.row)]!);
        const headY = 100 + (top - sheet.anchorY) * scale;
        for (let col = 0; col < strip.frames; col++) for (const mega of [false, true]) {
          const tick = col * (moving ? sheet.ticksPerFrame : sheet.idleTicksPerFrame!);
          const frame = playerFrame(sheet, { facing, moving, carrying: true, tick });
          const bomb = { fuse: FUSE_TICKS, type: "normal" as const, mega };
          const pose = carriedBombPose({ sheet, frame, cx: 80, feetY: 100, headY, bomb, tick });
          const art = mega ? BOMBS.mega : BOMBS;
          const radius = (mega ? 175 : 42) * art.scale * bombLook({ ...bomb, tick, carrying: true }).sy;
          const actualHead = 100 + (measured[name]!.rows[String(strip.row)]![col]! - sheet.anchorY) * scale;
          expect(pose.y + radius, `${name} ${strip.row}:${col} ${facing}`).toBeLessThanOrEqual(actualHead);
        }
      }
    }
  });
});
