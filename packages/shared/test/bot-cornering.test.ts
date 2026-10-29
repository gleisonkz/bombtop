import { describe, expect, it } from "vitest";
import { Bot, createMatch, FUSE_TICKS, step, Tile, TICK_RATE } from "../src";
import { center } from "./helpers";

function threatenedDuel(fuse = FUSE_TICKS) {
  const s = createMatch({ seed: 1, playerIds: ["bot", "rival"], blockDensity: 0 });
  const me = s.players[0]!;
  const rival = s.players[1]!;
  me.px = center(5);
  me.py = center(5);
  me.fireRange = 2;
  me.specialCooldown = FUSE_TICKS * 2;
  rival.px = center(7);
  rival.py = center(5);
  s.bombs.push({ ownerId: rival.id, x: 5, y: 3, fuse, range: 2, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
  return s;
}

describe("cornered bots", () => {
  it.each(["easy", "medium", "hard"] as const)("%s counterattacks a nearby rival while escaping a distant blast", level => {
    const s = threatenedDuel();
    const me = s.players[0]!;
    const bot = new Bot(me.id, level);
    const input = bot.input(s);
    expect(input.bomb).toBe(true);
    expect(input.dir).not.toBeNull();
    step(s, { bot: input });
    for (let i = 0; i < FUSE_TICKS + 5 && me.alive; i++) step(s, { bot: bot.input(s) });
    expect(me.alive).toBe(true);
  });

  it("prioritizes escape when the nearby bomb is about to explode", () => {
    const s = threatenedDuel(10);
    const input = new Bot("bot", "hard").input(s);
    expect(input.bomb).toBe(false);
    expect(input.dir).not.toBeNull();
  });

  it("does not counterattack when its own blast would cover every exit", () => {
    const s = threatenedDuel();
    s.grid.tiles.fill(Tile.Wall);
    for (const [x, y] of [[5, 3], [5, 4], [5, 5], [6, 5], [7, 5]] as const) s.grid.tiles[y * s.grid.width + x] = Tile.Empty;
    const input = new Bot("bot", "hard").input(s);
    expect(input.bomb).toBe(false);
    expect(input.dir).toBe("right");
  });

  it("goes around a permanent wall instead of settling opposite a rival", () => {
    const s = createMatch({ seed: 1, playerIds: ["bot", "rival"], blockDensity: 0 });
    const me = s.players[0]!;
    const rival = s.players[1]!;
    me.px = center(6);
    me.py = center(1);
    me.specialCooldown = FUSE_TICKS * 2;
    rival.px = center(6);
    rival.py = center(3);
    s.grid.tiles[3 * s.grid.width + 5] = Tile.Block;
    s.grid.tiles[3 * s.grid.width + 7] = Tile.Block;
    const bot = new Bot(me.id, "hard", "hunter");
    for (let i = 0; i < 400; i++) step(s, { bot: bot.input(s) });
    expect(s.grid.tiles.filter(tile => tile === Tile.Block).length).toBeLessThan(2);
  });

  it("turns toward a rival after a speed upgrade skips the exact tile center", () => {
    const s = createMatch({ seed: 1, playerIds: ["bot", "rival"], blockDensity: 0 });
    s.grid.tiles.fill(Tile.Wall);
    for (let x = 1; x <= 13; x++) s.grid.tiles[s.grid.width + x] = Tile.Empty;
    for (let y = 2; y <= 5; y++) s.grid.tiles[y * s.grid.width + 5] = Tile.Empty;
    const me = s.players[0]!;
    me.speed = 20;
    me.specialCooldown = FUSE_TICKS * 2;
    s.players[1]!.px = center(5);
    s.players[1]!.py = center(5);
    const bot = new Bot(me.id, "hard", "hunter");
    for (let i = 0; i < 100; i++) step(s, { bot: bot.input(s) });
    expect(me.py).toBeGreaterThan(center(1));
  });

  it.each(["mount", "flag"] as const)("does not get stuck requesting a character special disabled by its %s", restriction => {
    const s = createMatch({ seed: 1, playerIds: ["bot", "rival"], blockDensity: 0 });
    const me = s.players[0]!;
    me.character = "pikachu";
    if (restriction === "mount") me.mount = "hopper";
    else s.stageState = { flags: [{ ownerId: "rival", x: 1, y: 1, carriedBy: me.id }] };
    s.players[1]!.px = center(1);
    s.players[1]!.py = center(3);
    const input = new Bot(me.id, "hard", "hunter").input(s);
    expect(input.special).not.toBe(true);
    expect(input.dir !== null || input.bomb).toBe(true);
  });

  it("retreats into an attacking position without missing a short blast deadline", () => {
    const s = threatenedDuel(60);
    s.tick = 150 * TICK_RATE;
    const me = s.players[0]!;
    s.players[1]!.py = center(7);
    const bot = new Bot(me.id, "hard", "hunter");
    const input = bot.input(s);
    expect(input.dir).toBe("down");
    step(s, { bot: input });
    for (let i = 0; i < FUSE_TICKS + 10 && me.alive; i++) step(s, { bot: bot.input(s) });
    expect(me.alive).toBe(true);
  });
});
