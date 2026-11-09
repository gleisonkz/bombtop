import { describe, expect, it } from "vitest";
import { createMatch, placePlayerAt, playerTile, step, TILE, Tile, type MatchState } from "../src";
import { addFlame, placeBomb } from "../src/bombs";
import { launch } from "../src/air";
import { tryKick } from "../src/kick";
import { dropItems } from "../src/items";
import { getFloor, Floor, hasFlame, tileCenter } from "../src/state";

// Fixtures measured on Super Bomberman 4 in Snes9x (E:/Projetos/bombtop-src/sb4-evidence/seesaw): 1 tick = 1 frame.
// Initial state: the left seesaws (pivots (4,3), (4,9)) have their right end up (the end that tips them, (5,y)),
// the right ones (pivots (10,3), (10,9)) their left end ((9,y)).
function arena(): MatchState {
  return createMatch({ stage: "sb4-09", seed: 7, playerIds: ["a", "b"], blockDensity: 0 });
}
function clear(s: MatchState, x: number, y: number) { s.grid.tiles[y * s.grid.width + x] = Tile.Empty; }
function bombOf(s: MatchState, id: string, x: number, y: number) {
  const p = s.players.find(player => player.id === id)!;
  const { x: px, y: py } = playerTile(p);
  placePlayerAt(s, id, x, y);
  placeBomb(s, id);
  placePlayerAt(s, id, px, py);
  return s.bombs.at(-1)!;
}
function flip(s: MatchState) { // a player taps a tipping end and steps away
  placePlayerAt(s, "b", 5, 9);
  step(s);
  placePlayerAt(s, "b", 1, 11);
}

describe("SB4 seesaw: a bomb on the end that flies up", () => {
  it("crosses the seesaw, 6 tiles in 12 ticks, and comes down on the far side (e-bomb-on-launch-end)", () => {
    const s = arena();
    placePlayerAt(s, "a", 1, 1);
    const bomb = bombOf(s, "a", 3, 3);
    placePlayerAt(s, "b", 5, 3);
    step(s); // tick 1: tipped, the bomb is thrown to the right
    expect(bomb.air?.dir).toBe("right");
    for (let tick = 2; tick <= 12; tick++) {
      step(s);
      expect(bomb.air, `tick ${tick}`).toBeTruthy();
      expect(bomb.x).toBeGreaterThan(2);
    }
    step(s); // tick 13
    expect(bomb.air).toBeNull();
    expect({ x: bomb.x, y: bomb.y }).toEqual({ x: 9, y: 3 });
    expect(s.stageState!.seesaws![1]!.raised).toBe(true); // turned once, on tick 1: (9,3) was then down, landing there turns nothing
  });

  it("off the arena's edge, bounces a tile every 8 ticks round the border to the first free tile (e-bomb-launched-off-edge)", () => {
    const s = arena();
    // With two players SB4 fills the empty corners with blocks: in row 3, (12,3) and (13,3).
    for (const x of [12, 13]) s.grid.tiles[3 * s.grid.width + x] = Tile.Block;
    placePlayerAt(s, "a", 1, 1);
    placePlayerAt(s, "b", 1, 11);
    flip(s); // (5,3) is now down, (3,3) up
    for (let t = 0; t < 4; t++) step(s);
    const bomb = bombOf(s, "a", 5, 3);
    placePlayerAt(s, "b", 3, 3);
    let settled = 0;
    for (let tick = 1; tick <= 70 && !settled; tick++) {
      step(s);
      if (tick === 1) expect(bomb.air?.dir).toBe("left");
      if (tick === 1) placePlayerAt(s, "b", 1, 11);
      if (!bomb.air && tick > 1) settled = tick;
    }
    expect({ x: bomb.x, y: bomb.y }).toEqual({ x: 11, y: 3 });
    expect(settled).toBe(53);
  });
});

describe("SB4 seesaw: fire", () => {
  it("stops at the pivot and at the end that is up, and goes into the end that is down (e-flame-into-end)", () => {
    const s = arena();
    placePlayerAt(s, "a", 1, 1);
    s.players[0]!.fireRange = 3;
    const bomb = bombOf(s, "a", 3, 3);
    bomb.fuse = 1;
    step(s);
    expect(hasFlame(s, 2, 3)).toBe(true);
    expect(hasFlame(s, 4, 3)).toBe(false);
    expect(hasFlame(s, 5, 3)).toBe(false);
  });

  it("does not go into an end that is up from beside it, but does once it is down (e-flame-from-low-end)", () => {
    const up = arena();
    clear(up, 5, 4);
    placePlayerAt(up, "a", 1, 1);
    bombOf(up, "a", 5, 4).fuse = 1;
    step(up);
    expect(hasFlame(up, 5, 4)).toBe(true);
    expect(hasFlame(up, 5, 3)).toBe(false);

    const down = arena();
    clear(down, 5, 4);
    placePlayerAt(down, "a", 1, 1);
    placePlayerAt(down, "b", 1, 11);
    flip(down);
    for (let t = 0; t < 4; t++) step(down);
    expect(down.stageState!.seesaws![0]!.cooldown).toBe(0);
    bombOf(down, "a", 5, 4).fuse = 1;
    step(down);
    expect(hasFlame(down, 5, 3)).toBe(true);
  });

  it.each([0, 1])("goes into neither end on the tick the seesaws turn or the next (+%i) (e-fire-vs-flight)", after => {
    const s = arena();
    clear(s, 3, 4);
    clear(s, 5, 4);
    placePlayerAt(s, "a", 1, 1);
    placePlayerAt(s, "b", 1, 11);
    const left = bombOf(s, "a", 3, 4);
    const right = bombOf(s, "a", 5, 4);
    left.fuse = right.fuse = 1 + after;
    placePlayerAt(s, "b", 5, 9);
    step(s);
    placePlayerAt(s, "b", 1, 11);
    if (after) step(s);
    expect(hasFlame(s, 3, 4)).toBe(true);
    expect(hasFlame(s, 3, 3)).toBe(false);
    expect(hasFlame(s, 5, 3)).toBe(false);
  });
});

describe("SB4 seesaw: landing", () => {
  function hop(s: MatchState, onTick?: (tick: number) => void) {
    placePlayerAt(s, "a", 1, 11);
    placePlayerAt(s, "b", 3, 3);
    let landed = 0;
    for (let tick = 1; tick <= 30 && !landed; tick++) {
      if (tick === 1) placePlayerAt(s, "a", 5, 9);
      if (tick === 2) placePlayerAt(s, "a", 1, 11);
      onTick?.(tick);
      step(s, tick >= 2 ? { b: { dir: "right", bomb: false } } : {});
      if (tick > 1 && !s.stageState!.flights?.b) landed = tick;
    }
    return { landed, at: playerTile(s.players[1]!) };
  }

  it("in a flame burns the player a tick after landing; they are not moved out of it (e-fly-over-fire)", () => {
    const dry = hop(arena());
    expect(dry.at.y).toBe(3);
    const s = arena();
    const b = s.players[1]!;
    const wet = hop(s, tick => { if (tick === dry.landed - 2) addFlame(s, dry.at.x, dry.at.y, "a"); });
    expect(wet).toEqual(dry);
    expect(b.alive).toBe(true);
    step(s);
    expect(b.alive).toBe(false);
    expect(playerTile(b)).toEqual(dry.at);
  });
});

describe("SB4 seesaw: the pivot", () => {
  it.each([16, 20, 32])("always hops a player walking into it, at speed %i (walk-into-pivot-from-left)", speed => {
    const s = arena();
    placePlayerAt(s, "a", 3, 3);
    placePlayerAt(s, "b", 1, 11);
    const a = s.players[0]!;
    a.speed = speed;
    for (let tick = 0; tick < 40; tick++) {
      step(s, { a: { dir: "right", bomb: false } });
      // The game's cell is a 16th of a tile behind ours: the pivot runs from px 4*TILE + TILE/16 to 5*TILE.
      const cell = Math.floor((a.px - TILE / 16) / TILE);
      if (!s.stageState!.flights?.a) expect(cell, `tick ${tick}`).not.toBe(4);
    }
  });
});

describe("SB4 seesaw: bombs coming down", () => {
  it("a bomb landing on the end that is up turns every seesaw and throws whoever is on the other end", () => {
    const s = arena();
    clear(s, 2, 3);
    placePlayerAt(s, "a", 1, 1);
    placePlayerAt(s, "b", 3, 3);
    const bomb = bombOf(s, "a", 2, 3);
    launch(bomb, "right");
    const saws = s.stageState!.seesaws!;
    let landed = 0;
    for (let tick = 1; tick <= 40 && !landed; tick++) {
      step(s);
      if (!bomb.air) landed = tick;
    }
    expect({ x: bomb.x, y: bomb.y }).toEqual({ x: 5, y: 3 });
    expect(saws.map(saw => saw.raised)).toEqual([false, true, false, true]);
    step(s);
    expect(s.stageState!.flights?.b?.kind).toBe("seesaw");
  });

  it("a kicked bomb stops before the pivot and the end that is up, and slides into the end that is down", () => {
    const s = arena();
    clear(s, 1, 3);
    clear(s, 2, 3);
    placePlayerAt(s, "b", 1, 11);
    placePlayerAt(s, "a", 1, 3);
    const a = s.players[0]!;
    a.canKick = true;
    const bomb = bombOf(s, "a", 2, 3);
    tryKick(s, a, "right");
    for (let t = 0; t < 40; t++) step(s);
    expect({ x: bomb.x, y: bomb.y }).toEqual({ x: 3, y: 3 });
  });
});

describe("SB4 seesaw: scattered items", () => {
  it("never land on a seesaw", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createMatch({ stage: "sb4-09", seed, playerIds: ["a", "b"], blockDensity: 0 });
      s.grid.tiles = s.grid.tiles.map(tile => tile === Tile.Block ? Tile.Empty : tile);
      const a = s.players[0]!;
      Object.assign(a, { fireRange: 8, maxBombs: 8, canKick: true, canPunch: true });
      a.alive = false;
      dropItems(s, a);
      expect(s.items.length).toBeGreaterThan(0);
      for (const item of s.items) expect(getFloor(s, item.x, item.y), `${seed}: ${item.x},${item.y}`).not.toBe(Floor.Seesaw);
    }
  });
});

void tileCenter;
