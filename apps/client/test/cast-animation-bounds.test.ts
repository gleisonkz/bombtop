import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import bounds from "../src/ui/cast-animation-bounds.json";
import { CHARACTER_SHEETS, previewPose } from "../src/ui/sheet-art";

const measureAlphaBounds = `
import json, sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1])
result = {}
for spec in json.load(sys.stdin):
    image = Image.open(root / spec['url']).convert('RGBA')
    assert image.size == (spec['width'], spec['height']), spec['id']
    width, height = spec['frameW'], spec['frameH']
    top = spec['row'] * height
    assert top >= 0 and top + height <= image.height, spec['id']
    assert spec['frames'] * width <= image.width, spec['id']
    boxes = []
    for frame in range(spec['frames']):
        left = frame * width
        alpha = image.getchannel('A').crop((left, top, left + width, top + height))
        box = alpha.getbbox()
        if box:
            boxes.append(box)
    assert boxes, spec['id']
    result[spec['id']] = [min(box[0] for box in boxes), max(box[2] for box in boxes)]
print(json.dumps(result))
`;

describe("menu cast animation bounds", () => {
  it("matches the alpha union of every walk-preview frame for all 17 companions", () => {
    const previews = Object.entries(CHARACTER_SHEETS)
      .filter(([id]) => id !== "bomb")
      .map(([id, source]) => {
        const pose = previewPose(source, "walk");
        const sheet = pose.sheet ?? source;
        return {
          id, url: sheet.url.split("?")[0],
          width: sheet.width, height: sheet.height,
          frameW: sheet.frameW, frameH: sheet.frameH,
          row: pose.row, frames: pose.frames,
        };
      });
    expect(previews).toHaveLength(17);
    const output = execFileSync("python", ["-c", measureAlphaBounds,
      fileURLToPath(new URL("../public/", import.meta.url))], {
      input: JSON.stringify(previews), encoding: "utf8",
    });
    expect(bounds).toEqual(JSON.parse(output));
  });
});
