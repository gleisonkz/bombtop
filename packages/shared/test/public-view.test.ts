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
