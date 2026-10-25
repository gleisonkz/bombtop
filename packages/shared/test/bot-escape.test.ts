import { describe, expect, it } from "vitest";
import { Bot, createMatch, FUSE_TICKS, ItemKind, step, Tile } from "../src";
import { center } from "./helpers";

describe("bot escape", () => {
  it("does not rely on a collectible item to block its own blast", () => {
    const s = createMatch({ seed: 1, playerIds: ["bot", "idle"], blockDensity: 0 });
    const me = s.players[0]!;
    const rival = s.players[1]!;
    me.px = center(5);
    me.py = center(1);
    me.fireRange = 2;
    me.specialCooldown = FUSE_TICKS + 10; // exercise ordinary bomb escape, not the new mega-bomb plan
    rival.px = center(7);
    rival.py = center(1);
    s.items.push({ x: 5, y: 2, kind: ItemKind.Fire });
    s.grid.tiles[3 * s.grid.width + 4] = Tile.Block;
    s.grid.tiles[3 * s.grid.width + 6] = Tile.Block;
    s.grid.tiles[4 * s.grid.width + 5] = Tile.Block;

    const bot = new Bot(me.id, "hard");
    const first = bot.input(s);
    expect(first.bomb).toBe(true);
    step(s, { bot: first });
    for (let i = 0; i < FUSE_TICKS + 5 && me.alive; i++) step(s, { bot: bot.input(s) });

    expect(me.alive).toBe(true);
  });

  it("moves toward safety when controls are reversed", () => {
    const s = createMatch({ seed: 1, playerIds: ["bot", "idle"], blockDensity: 0 });
    const me = s.players[0]!;
    const rival = s.players[1]!;
    rival.px = center(11);
    rival.py = center(1);
    me.curse = { kind: "reverse" };

    const bot = new Bot(me.id, "hard");
    const before = me.px;
    step(s, { bot: bot.input(s) });

    expect(me.px).toBeGreaterThan(before);
  });

  it("avoids a skull when another escape from a bomb exists", () => {
    const s = createMatch({ seed: 1, playerIds: ["bot", "idle"], blockDensity: 0 });
    const me = s.players[0]!;
    me.px = center(1);
    me.py = center(5);
    s.bombs.push({ ownerId: me.id, x: 1, y: 7, fuse: 120, range: 4, type: "normal", slide: null, offset: 0, air: null, heldBy: null });
    s.items.push({ x: 2, y: 5, kind: ItemKind.Skull });

    expect(new Bot(me.id, "hard").input(s).dir).toBe("up");
  });
});
