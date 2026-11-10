import { describe, expect, it } from "vitest";
import { createMatch, ItemKind, publicView, setTile, Tile } from "../src";
import { emptyMatch } from "./helpers";

describe("publicView", () => {
  it("hides items still buried under blocks", () => {
    const s = emptyMatch();
    setTile(s, 3, 3, Tile.Block);
    s.items.push({ x: 3, y: 3, kind: ItemKind.Skull }, { x: 5, y: 5, kind: ItemKind.Fire });
    expect(publicView(s).items).toEqual([{ x: 5, y: 5, kind: ItemKind.Fire }]);
  });

  it("omits the PRNG state, which would reveal upcoming random outcomes", () => {
    expect("rng" in publicView(emptyMatch())).toBe(false);
  });

  it.each(["sb2-01", "sb2-02", "sb2-03", "sb2-04", "sb2-05", "sb2-06", "sb2-07", "sb2-08", "sb2-09", "sb2-10", "sb2-11"] as const)("hides the native item bag and RNG of %s without changing server state", stage => {
    const s = createMatch({ stage, seed: 1234, playerIds: ["a", "b"] });
    s.stageState!.sb2!.randomHistory = Array.from({ length: 16 }, (_, i) => i * 7);
    s.players[0]!.curse = { kind: "invisible", sb2Status: 1, elapsed: 193 };
    const before = structuredClone(s), v = publicView(s);
    expect(v.stageState!.sb2).not.toHaveProperty("itemBag");
    expect(v.stageState!.sb2).not.toHaveProperty("randomSeed");
    expect(v.stageState!.sb2).not.toHaveProperty("randomWord");
    expect(v.stageState!.sb2).not.toHaveProperty("randomHistory");
    expect(v.players[0]!.curse).toEqual(s.players[0]!.curse);
    expect(s).toEqual(before);
    expect(s.stageState!.sb2!.itemBag!.slots).toHaveLength(64);
  });

  it("keeps everything else", () => {
    const s = createMatch({ seed: 9, playerIds: ["a", "b"] });
    const v = publicView(s);
    expect(v.grid).toEqual(s.grid);
    expect(v.players).toEqual(s.players);
    expect(v.tick).toBe(s.tick);
  });

  it("is a copy that does not alias the live state", () => {
    const s = emptyMatch();
    const v = publicView(s);
    v.players[0]!.px = -1;
    expect(s.players[0]!.px).not.toBe(-1);
  });
});
