import { describe, expect, it } from "vitest";
import { BattleSession, BOT_LEVELS, FUSE_TICKS, playerTile, Tile, type BotLevel } from "../src";
import { center } from "./helpers";

function mixedMatch(level: BotLevel, seed = 1) {
  const session = new BattleSession({ seed: () => seed, random: () => 0, blockDensity: 0 });
  session.join("human-1", "Player 1");
  session.join("human-2", "Player 2");
  session.addBot("human-1", level);
  session.addBot("human-1", level);
  session.setReady("human-2", true);
  expect(session.start("human-1")).toBe(true);
  const match = session.match!;
  const bots = match.players.filter((p) => p.id.startsWith("bot-"));
  for (const bot of bots) {
    bot.px = center(5);
    bot.py = center(5);
    bot.specialCooldown = 1000;
  }
  match.bombs.push({ ownerId: "human-1", x: 5, y: 5, fuse: FUSE_TICKS, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
  return { session, match, bots };
}

describe("two humans and two bots", () => {
  it.each(BOT_LEVELS)("%s bots break equivalent escape-route ties independently", (level) => {
    for (const seed of [1, 2, 3, 4]) {
      const { session, bots } = mixedMatch(level, seed);
      session.tick();
      const moves = bots.map((p) => [p.px - center(5), p.py - center(5)]);
      expect(moves[0], `seed ${seed}`).not.toEqual([0, 0]);
      expect(moves[1], `seed ${seed}`).not.toEqual([0, 0]);
      expect(moves[0], `seed ${seed}`).not.toEqual(moves[1]);
    }
  });

  it("keeps both bots safe when they have to share the only escape route", () => {
    const { session, match, bots } = mixedMatch("hard");
    for (const [x, y] of [[5, 4], [5, 6], [4, 5]] as const) match.grid.tiles[y * match.grid.width + x] = Tile.Wall;
    session.tick();
    for (const bot of bots) {
      expect(bot.px).toBeGreaterThan(center(5));
      expect(bot.py).toBe(center(5));
    }
    for (let tick = 1; tick <= FUSE_TICKS + 1; tick++) session.tick();
    for (const bot of bots) {
      expect(bot.alive).toBe(true);
      expect(playerTile(bot)).not.toEqual({ x: 5, y: 5 });
    }
  });

  it("breaks equivalent walking-route ties independently while pursuing humans", () => {
    const { session, match, bots } = mixedMatch("hard");
    match.bombs = [];
    for (const bot of bots) {
      bot.bombCapacity = 0;
      bot.sneak = 1000;
    }
    session.tick();
    const moves = bots.map((p) => [p.px - center(5), p.py - center(5)]);
    expect(moves[0]).not.toEqual([0, 0]);
    expect(moves[1]).not.toEqual([0, 0]);
    expect(moves[0]).not.toEqual(moves[1]);
  });

  it("replays each bot's escape deterministically for the same match seed", () => {
    function trail() {
      const { session, bots } = mixedMatch("medium", 42);
      const positions: number[][] = [];
      for (let tick = 0; tick <= FUSE_TICKS; tick++) {
        session.tick();
        positions.push(bots.flatMap((p) => [p.px, p.py, Number(p.alive)]));
      }
      expect(bots.every((p) => p.alive)).toBe(true);
      return positions;
    }
    expect(trail()).toEqual(trail());
  });
});
