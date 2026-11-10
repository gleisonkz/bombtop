import { describe, expect, it } from "vitest";
import { createMatch, Floor, publicView, SB2_STAGES } from "@bombtop/shared";
import { sb2FloorDecals, SB2_FLOOR_CELLS } from "../src/render/sb2-floor-decals";

const view = (stage: (typeof SB2_STAGES)[number]) => publicView(createMatch({ seed: 3, stage, playerIds: ["a", "b"] }));
const at = (decals: ReturnType<typeof sb2FloorDecals>, x: number, y: number) => decals.filter(d => d.x === x && d.y === y);

describe("SB2 floor decals", () => {
  it("draws nothing outside SB2 arenas and nothing on arena 1", () => {
    expect(sb2FloorDecals(publicView(createMatch({ seed: 1, playerIds: ["a", "b"] })))).toEqual([]);
    expect(sb2FloorDecals(view("sb2-01"))).toEqual([]);
  });

  it("covers arena 2 in ice, with launch circles and the track between them", () => {
    const decals = sb2FloorDecals(view("sb2-02"));
    expect(at(decals, 3, 3).map(d => d.cell)).toContain("launch");
    expect(at(decals, 5, 5).map(d => d.cell)).toContain("track-hub");
    expect(at(decals, 5, 5).filter(d => d.cell === "track-arm").map(d => d.rotation).sort()).toEqual([0, 2]);
    expect(decals.filter(d => d.cell === "ice").length).toBeGreaterThan(30);
  });

  it("draws arena 4's channel ring", () => {
    expect(sb2FloorDecals(view("sb2-04")).filter(d => d.cell === "channel-hub")).toHaveLength(28);
  });

  it("shows plates and arrows only where no block hides them", () => {
    const plates = sb2FloorDecals(view("sb2-05")).filter(d => d.cell === "plate");
    expect(plates.map(d => `${d.x},${d.y}`).sort()).toEqual(["11,3", "11,9", "7,1", "9,5", "9,7"]);
    const arrows = sb2FloorDecals(view("sb2-09")).filter(d => d.cell === "arrow");
    expect(arrows.map(d => [d.x, d.y, d.rotation])).toEqual(expect.arrayContaining([[1, 1, 2], [13, 1, 3], [1, 11, 1], [13, 11, 0]]));
    expect(arrows).toHaveLength(4);
  });

  it("puts warps on arena 6 and the numbered and pause pads on arena 7", () => {
    expect(sb2FloorDecals(view("sb2-06")).filter(d => d.cell === "warp").map(d => `${d.x},${d.y}`).sort()).toEqual(["11,3", "11,9", "3,3", "3,9"]);
    const s = view("sb2-07");
    expect(at(sb2FloorDecals(s), 7, 6)[0]!.cell).toBe("pause");
    expect(at(sb2FloorDecals(s), 2, 6)[0]!.cell).toBe("pad-3");
    s.stageState!.sb2!.stage7 = { ...(s.stageState!.sb2!.stage7 ?? {}), numbers: { left: 5, right: 1 } } as never;
    expect(at(sb2FloorDecals(s), 2, 6)[0]!.cell).toBe("pad-5");
    expect(at(sb2FloorDecals(s), 12, 6)[0]!.cell).toBe("pad-1");
  });

  it("runs arena 8's belt clockwise, and the other way once reversed", () => {
    const s = view("sb2-08");
    expect(at(sb2FloorDecals(s), 5, 3)[0]).toMatchObject({ belt: Floor.ConveyorRight });
    expect(at(sb2FloorDecals(s), 3, 5)[0]).toMatchObject({ belt: Floor.ConveyorUp });
    expect(at(sb2FloorDecals(s), 7, 5)[0]!.cell).toBe("switch-reverse");
    expect(at(sb2FloorDecals(s), 7, 7)[0]!.cell).toBe("switch-speed");
    s.stageState!.sb2!.conveyor = { control: { reversed: true, fast: false } } as never;
    expect(at(sb2FloorDecals(s), 5, 3)[0]).toMatchObject({ belt: Floor.ConveyorLeft });
  });

  it("marks arena 3's tunnels, arena 11's launch edge and arena 12's floors", () => {
    expect(sb2FloorDecals(view("sb2-03")).filter(d => d.cell === "tunnel")).toHaveLength(4);
    const edge = sb2FloorDecals(view("sb2-11")).filter(d => d.cell === "launcher");
    expect(edge).toHaveLength(50);
    expect(at(edge, 5, 12)[0]!.rotation).toBe(0);
    expect(at(edge, 5, 0)[0]!.rotation).toBe(2);
    const s = view("sb2-12");
    expect(at(sb2FloorDecals(s), 6, 3)[0]!.cell).toBe("trap");
    expect(at(sb2FloorDecals(s), 4, 3)[0]!.cell).toBe("spring");
    s.stageState!.sb2!.stage12Floors = [{ x: 6, y: 3 }] as never;
    expect(at(sb2FloorDecals(s), 6, 3)[0]!.cell).toBe("trap-used");
  });

  it("only names cells the atlas has", () => {
    for (const stage of SB2_STAGES) for (const d of sb2FloorDecals(view(stage))) {
      if (d.cell !== "warp" && d.cell !== "belt") expect(SB2_FLOOR_CELLS).toContain(d.cell);
    }
  });
});
