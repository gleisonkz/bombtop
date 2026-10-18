import { describe, expect, it } from "vitest";
import { Bot, BOT_LEVELS, botInput, createMatch, FUSE_TICKS, ItemKind, step, Tile, TICK_RATE, type MatchState } from "../src";
import { center, emptyMatch, player } from "./helpers";

/** Runs the match with `bots` driven by the AI and everyone else idle. */
function play(s: MatchState, bots: string[], ticks: number) {
  for (let i = 0; i < ticks; i++) {
    const inputs = Object.fromEntries(bots.map((id) => [id, botInput(s, id)]));
    step(s, inputs);
  }
}

const blocks = (s: MatchState) => s.grid.tiles.filter((t) => t === Tile.Block).length;

describe("botInput", () => {
  it("runs away from a bomb it is standing on", () => {
    const s = emptyMatch();
    s.bombs.push({ ownerId: "p1", x: 1, y: 1, fuse: FUSE_TICKS, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    play(s, ["p1"], FUSE_TICKS + 40);
    expect(player(s).alive).toBe(true);
  });

  it("never walks into fire", () => {
    const s = emptyMatch();
    s.flames.push({ x: 2, y: 1, ttl: 1000 }, { x: 1, y: 2, ttl: 1000 });
    play(s, ["p1"], 120);
    expect(player(s).alive).toBe(true);
  });

  it("goes for a nearby power-up", () => {
    const s = emptyMatch();
    s.items.push({ x: 3, y: 1, kind: ItemKind.Fire });
    play(s, ["p1"], 2 * TICK_RATE);
    expect(s.items).toHaveLength(0);
    expect(player(s).fireRange).toBe(2);
  });

  it("bombs an enemy in reach and survives its own blast", () => {
    const s = emptyMatch();
    const target = player(s, "p2");
    target.px = center(3);
    target.py = center(1);
    play(s, ["p1"], FUSE_TICKS + 2 * TICK_RATE);
    expect(target.alive).toBe(false);
    expect(player(s).alive).toBe(true);
  });

  it("clears blocks and does not blow itself up over a long match", () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = createMatch({ seed, playerIds: ["bot", "idle"], revenge: false });
      const before = blocks(s);
      play(s, ["bot"], 40 * TICK_RATE);
      expect(blocks(s), `seed ${seed}`).toBeLessThan(before - 4);
      expect(player(s, "bot").alive, `seed ${seed}`).toBe(true);
    }
  });

  it("plays a full bots-only match to a result without errors", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const s = createMatch({ seed: 7, playerIds: ids });
    play(s, ids, 90 * TICK_RATE);
    expect(s.players.filter((p) => p.alive).length).toBeLessThan(5);
  });
});

describe("Bot levels", () => {
  it("throws a bomb it is carrying instead of holding it forever", () => {
    const s = emptyMatch();
    s.bombs.push({ ownerId: "p1", x: 1, y: 1, fuse: FUSE_TICKS, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: "p1" });
    expect(new Bot("p1", "hard").input(s).bomb).toBe(true);
  });

  it("every level survives its own bombs in an open arena", () => {
    for (const level of BOT_LEVELS) {
      const s = createMatch({ seed: 5, playerIds: ["bot", "idle"], revenge: false });
      const bot = new Bot("bot", level);
      for (let i = 0; i < 60 * TICK_RATE; i++) step(s, { bot: bot.input(s) });
      expect(player(s, "bot").alive, level).toBe(true);
      expect(blocks(s), level).toBeLessThan(blocks(createMatch({ seed: 5, playerIds: ["bot", "idle"] })));
    }
  });

  it("harder bots react faster", () => {
    const thinkTicks = (level: "easy" | "hard") => {
      const s = emptyMatch();
      s.items.push({ x: 4, y: 1, kind: ItemKind.Bomb });
      const bot = new Bot("p1", level);
      for (let t = 0; t < 10 * TICK_RATE; t++) {
        step(s, { p1: bot.input(s) });
        if (!s.items.length) return t;
      }
      return Infinity;
    };
    expect(thinkTicks("hard")).toBeLessThanOrEqual(thinkTicks("easy"));
  });
});
