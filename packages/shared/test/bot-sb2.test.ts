import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { botDangerMap } from "../src/bot";
import { SB2_CHANNEL_CELLS } from "../src/sb2-channel";
import { Tile, type MatchState } from "../src/state";

function arena4(): MatchState {
  return createMatch({ seed: 1, stage: "sb2-04", playerIds: ["a", "b"] });
}

describe("bots on SB2 arena 4 (the fuse channel)", () => {
  it("sees the whole channel burn when a bomb's blast reaches any of it", () => {
    const s = arena4();
    const lit = SB2_CHANNEL_CELLS[0]!;
    s.grid.tiles[lit.y * s.grid.width + lit.x] = Tile.Empty;
    s.bombs.push({ ownerId: "b", x: lit.x, y: lit.y, fuse: 90, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    const far = SB2_CHANNEL_CELLS.reduce((best, c) =>
      Math.abs(c.x - lit.x) + Math.abs(c.y - lit.y) > Math.abs(best.x - lit.x) + Math.abs(best.y - lit.y) ? c : best);
    const danger = botDangerMap(s, "a");
    const t = danger.get(far.y * s.grid.width + far.x);
    expect(t).toBeDefined();
    expect(t!).toBeLessThanOrEqual(90);
  });

  it("sees every channel cell burning while the channel is lit", () => {
    const s = arena4();
    s.stageState!.sb2!.channel = { clock: { index: 3, timer: 2 }, ownerId: "b" };
    const danger = botDangerMap(s, "a");
    for (const c of SB2_CHANNEL_CELLS) expect(danger.get(c.y * s.grid.width + c.x)).toBe(0);
  });
});
