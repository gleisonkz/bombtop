import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CHARACTERS } from "@bombtop/shared";
import { CAST_BODY_HEIGHT, CAST_HORIZONTAL_BOUNDS, castLayout, type CastArt } from "../src/ui/cast-layout";
import { CHARACTER_SHEETS, previewPose } from "../src/ui/sheet-art";

const left = new Set(["goku", "naruto", "static", "flash", "lantern", "pele", "harry", "penelope"]);
const art: CastArt[] = CHARACTERS.filter((id) => id !== "bomb").map((id) => {
  const source = CHARACTER_SHEETS[id];
  const sheet = previewPose(source, "walk").sheet ?? source;
  return { id, side: left.has(id) ? "left" : "right", frameW: sheet.frameW, frameH: sheet.frameH, anchorX: sheet.anchorX, anchorY: sheet.anchorY, bodyH: CAST_BODY_HEIGHT[id], horizontalBounds: CAST_HORIZONTAL_BOUNDS[id] };
});

describe("single-row menu cast", () => {
  it("reserves the same vertical space through every mobile rotation", () => {
    const layouts = art.map((_, rotation) => castLayout({ art, width: 350, heroWidth: 150, heroHeight: 140, maxBodyHeight: 104, rotation }));
    expect(new Set(layouts.map((layout) => layout.height)).size).toBe(1);
    expect(new Set(layouts.map((layout) => layout.footroom)).size).toBe(1);
    for (const layout of layouts) {
      for (const member of layout.members) {
        const source = art.find((item) => item.id === member.id)!;
        expect(layout.height).toBeGreaterThanOrEqual(source.anchorY * member.scale);
        expect(layout.footroom).toBeGreaterThanOrEqual((source.frameH - source.anchorY) * member.scale);
      }
    }
  });
  it("keeps the measured Harry bounds in sync with every real animation frame", () => {
    const image = CHARACTER_SHEETS.harry.lobby!.image!;
    const path = fileURLToPath(new URL(`../public/${image.url}`, import.meta.url));
    const measured = execFileSync("python", ["-c", "from PIL import Image; import json, sys; im=Image.open(sys.argv[1]).convert('RGBA'); w=int(sys.argv[2]); boxes=[im.crop((x,0,x+w,im.height)).getbbox() for x in range(0,im.width,w)]; boxes=[b for b in boxes if b]; print(json.dumps([min(b[0] for b in boxes),max(b[2] for b in boxes)]))", path, String(image.frameW)], { encoding: "utf8" });
    expect(JSON.parse(measured)).toEqual(CAST_HORIZONTAL_BOUNDS.harry);
  });
  it("reserves Harry's visible animation rather than the transparent canvas", () => {
    const harry = art.find((item) => item.id === "harry")!;
    const layout = castLayout({ art: [harry], width: 1000, heroWidth: 110, heroHeight: 128, maxBodyHeight: 76 });
    const member = layout.members[0]!;
    const [left, right] = CAST_HORIZONTAL_BOUNDS.harry;
    expect(member.width).toBeCloseTo((right - left) * member.scale);
    expect(member.width).toBeLessThan(harry.frameW * member.scale);
    expect(member.anchorOffset).toBeCloseTo((harry.anchorX - left) * member.scale);
    expect(layout.wings.left.start * layout.bodyHeight + member.anchorOffset + (left - harry.anchorX) * member.scale).toBeCloseTo(0);
  });
  it("keeps Optimus close while reserving the truck's reach at the outer edges", () => {
    const optimus = art.find((item) => item.id === "optimus")!;
    const layout = castLayout({ art: [optimus], width: 1000, heroWidth: 110, heroHeight: 128, maxBodyHeight: 76 });
    const member = layout.members[0]!;
    expect(member.width).toBeCloseTo(137 * member.scale);
    const start = layout.wings.right.start * layout.bodyHeight;
    const end = layout.wings.right.end * layout.bodyHeight;
    expect(start + member.anchorOffset - optimus.anchorX * member.scale).toBeCloseTo(0);
    expect(start + member.anchorOffset + (320 - optimus.anchorX) * member.scale).toBeCloseTo(start + member.width + end);
  });
  it.each([350, 1000, 1720, 1888, 2200])("reserves every animated frame inside %s pixels", (width) => {
    const layout = castLayout({ art, width, heroWidth: 110, heroHeight: 128, maxBodyHeight: 76 });
    const total = layout.members.reduce((sum, member) => sum + member.width, 110) + layout.gap * layout.members.length;
    expect(total).toBeLessThanOrEqual(width + 0.001);
    expect(layout.bodyHeight).toBeGreaterThanOrEqual(44);
    for (const side of ["left", "right"]) {
      const members = layout.members.filter((member) => art.find((item) => item.id === member.id)!.side === side);
      const edges = layout.wings[side as "left" | "right"];
      const used = members.reduce((sum, member) => sum + member.width, 0) + layout.gap * Math.max(0, members.length - 1) + (edges.start + edges.end) * layout.bodyHeight;
      expect(used).toBeLessThanOrEqual((width - 110) / 2 - layout.gap + 0.001);
    }
    for (const member of layout.members) {
      const source = art.find((item) => item.id === member.id)!;
      const [left, right] = source.id === "optimus" ? [92, 229] : source.horizontalBounds ?? [0, source.frameW];
      expect(member.anchorOffset + (left! - source.anchorX) * member.scale).toBeGreaterThanOrEqual(-0.001);
      expect(member.anchorOffset + (right! - source.anchorX) * member.scale).toBeLessThanOrEqual(member.width + 0.001);
      expect(source.bodyH * member.scale).toBeCloseTo(layout.bodyHeight);
    }
  });

  it("removes outer companions before shrinking them below the readable minimum", () => {
    const small = castLayout({ art, width: 350, heroWidth: 136, heroHeight: 118, maxBodyHeight: 76 });
    const large = castLayout({ art, width: 1888, heroWidth: 144, heroHeight: 128, maxBodyHeight: 76 });
    expect(small.members.length).toBeLessThan(large.members.length);
    expect(large.members).toHaveLength(17);
    expect(small.members.some((member) => member.id === "captain")).toBe(true);
    expect(small.members.some((member) => member.id === "goku")).toBe(true);
  });

  it("cycles every companion into view on small screens", () => {
    const visited = new Set<string>();
    for (let rotation = 0; rotation < art.length; rotation++) {
      const layout = castLayout({ art, width: 350, heroWidth: 136, heroHeight: 118, maxBodyHeight: 76, rotation });
      for (const member of layout.members) visited.add(member.id);
      expect(layout.bodyHeight).toBeGreaterThanOrEqual(44);
      if (layout.members.length > 1) expect(layout.bodyHeight).toBeGreaterThanOrEqual(64);
    }
    expect(visited.size).toBe(art.length);
  });

  it.each(["left", "right"] as const)("fits Optimus's full truck animation in the %s wing on his rotation", (side) => {
    const optimus = art.find((item) => item.id === "optimus")!;
    const rotatedArt = art.map((item) => item.id === "optimus" ? { ...item, side } : item);
    const layout = castLayout({ art: rotatedArt, width: 350, heroWidth: 136, heroHeight: 118, maxBodyHeight: 76, minBodyHeight: 64, rotation: 15 });
    expect(layout.members.map((member) => member.id)).toEqual(["optimus"]);
    const member = layout.members[0]!;
    const space = (350 - 136) / 2 - layout.gap;
    expect(layout.bodyHeight).toBeGreaterThan(0);
    expect(layout.bodyHeight).toBeLessThan(64);
    expect(layout.bodyHeight).toBeCloseTo(space * optimus.bodyH / 320);
    const start = layout.wings[side].start * layout.bodyHeight;
    const end = layout.wings[side].end * layout.bodyHeight;
    const paintLeft = start + member.anchorOffset - optimus.anchorX * member.scale;
    const paintRight = start + member.anchorOffset + (320 - optimus.anchorX) * member.scale;
    expect(paintLeft).toBeCloseTo(0);
    expect(paintRight).toBeCloseTo(space);
    expect(start + member.width + end).toBeCloseTo(space);
    expect(layout.height).toBeGreaterThanOrEqual(optimus.anchorY * member.scale);
    expect(layout.footroom).toBeGreaterThanOrEqual((optimus.frameH - optimus.anchorY) * member.scale);
  });

  it("keeps carousel characters large and limits how many fit in a narrow menu", () => {
    const compact = castLayout({ art, width: 350, heroWidth: 136, heroHeight: 118, maxBodyHeight: 76, minBodyHeight: 58 });
    const regular = castLayout({ art, width: 720, heroWidth: 136, heroHeight: 118, maxBodyHeight: 104, minBodyHeight: 70 });
    expect(compact.bodyHeight).toBeGreaterThanOrEqual(58);
    expect(regular.bodyHeight).toBeGreaterThanOrEqual(70);
    expect(compact.members.length).toBeLessThan(art.length);
    expect(regular.members.length).toBeLessThan(art.length);
  });

  it("gives Thor and Captain the same body height despite different lobby canvases", () => {
    const layout = castLayout({ art, width: 1888, heroWidth: 110, heroHeight: 128, maxBodyHeight: 76 });
    const captain = layout.members.find((member) => member.id === "captain")!;
    const thor = layout.members.find((member) => member.id === "thor")!;
    expect(captain.scale * 124).toBeCloseTo(thor.scale * 127);
    expect(layout.height).toBeGreaterThanOrEqual(128);
  });
});
