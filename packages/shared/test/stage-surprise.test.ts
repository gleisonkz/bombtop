import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { Floor, placePlayerAt, tileCenter, Tile, type MatchState, type PlayerInput } from "../src/state";
import { igniteSurpriseFloor, moveSurprisePlayer, stopStageStickyBombs, SURPRISE_CONFIG, updateSurpriseFloors } from "../src/stage-surprise";

function fixture(kind: "normal" | "ice" | "sticky" | "reverse" = "normal") {
  const s = createMatch({ seed: 42, playerIds: ["p1", "p2"], blockDensity: 0 });
  // StageId is extended by the integrating task, outside these four files.
  Object.assign(s, { stage: "sb4-06" });
  const index = 5 * s.grid.width + 5;
  s.grid.floor[index] = Floor.Surprise;
  s.stageState = { surprise: { [index]: { kind, hits: 0 } }, floorLocks: {} };
  placePlayerAt(s, "p1", 5, 5);
  s.players[0]!.facing = "right";
  return { s, p: s.players[0]!, index };
}

const input = (dir: PlayerInput["dir"]): Record<string, PlayerInput> => ({ p1: { dir, bomb: false } });

describe("surprise floor ignition", () => {
  it("changes the floor once per tile per tick, consuming no duplicate random draws", () => {
    const { s, index } = fixture();
    igniteSurpriseFloor(s, 5, 5);
    expect(s.stageState!.surprise![index]!.kind).not.toBe("normal");
    expect(s.stageState!.surprise![index]!.hits).toBe(1);
    const snapshot = structuredClone(s);
    igniteSurpriseFloor(s, 5, 5);
    expect(s).toEqual(snapshot);
    s.tick++;
    igniteSurpriseFloor(s, 5, 5);
    expect(s.stageState!.surprise![index]!.hits).toBe(2);
  });

  it("replays changes from serialized state and the match PRNG", () => {
    const { s } = fixture();
    const replay = structuredClone(s);
    for (let tick = 0; tick < 20; tick++) {
      s.tick = replay.tick = tick;
      igniteSurpriseFloor(s, 5, 5);
      igniteSurpriseFloor(replay, 5, 5);
    }
    expect(s).toEqual(replay);
    expect(s.rng).not.toBe(42);
  });

  it("ignores other stages, ordinary floors and out-of-bounds positions", () => {
    const { s } = fixture();
    const before = structuredClone(s);
    igniteSurpriseFloor(s, -1, 5);
    igniteSurpriseFloor(s, 1, 1);
    expect(s).toEqual(before);
    s.stage = "classic";
    const creative = structuredClone(s);
    igniteSurpriseFloor(s, 5, 5);
    expect(updateSurpriseFloors(s, input("right"))).toEqual(new Set());
    expect(s).toEqual(creative);
  });

  it("initializes missing per-stage state only when a surprise tile ignites", () => {
    const { s, index } = fixture();
    Reflect.deleteProperty(s, "stageState");
    igniteSurpriseFloor(s, 5, 5);
    expect(s.stageState?.surprise?.[index]?.hits).toBe(1);
  });
});

describe("surprise floor movement", () => {
  it("owns one player's move without moving any other player", () => {
    const { s, p, index } = fixture("sticky");
    const other = s.players[1]!;
    placePlayerAt(s, other.id, 5, 5);
    const controls = { dir: "right" as const, bomb: false };
    expect(moveSurprisePlayer(s, p, controls)).toBe(true);
    expect(p.px).toBe(tileCenter(5) + p.speed * SURPRISE_CONFIG.stickySpeedScale);
    expect(other.px).toBe(tileCenter(5));
    const px = p.px;
    expect(moveSurprisePlayer(s, p, controls)).toBe(true);
    expect(p.px).toBe(px);
    expect(p.facing).toBe("right");
    s.tick++;
    s.stageState!.surprise![index]!.kind = "normal";
    expect(moveSurprisePlayer(s, p, controls)).toBe(false);
    expect(p.px).toBe(px);
  });

  it("leaves normal-floor movement for the caller", () => {
    const { s, p } = fixture();
    expect(updateSurpriseFloors(s, input("right"))).toEqual(new Set());
    expect(p.px).toBe(tileCenter(5));
  });

  it("slows only this move without changing player speed, curse or supplied input", () => {
    const { s, p } = fixture("sticky");
    const controls = input("right");
    const speed = p.speed;
    expect(updateSurpriseFloors(s, controls)).toEqual(new Set(["p1"]));
    expect(p.px).toBe(tileCenter(5) + speed * SURPRISE_CONFIG.stickySpeedScale);
    expect(p.speed).toBe(speed);
    expect(p.curse).toBeNull();
    expect(controls).toEqual(input("right"));
  });

  it("locks ice momentum despite steering changes and released input", () => {
    const { s, p } = fixture("ice");
    updateSurpriseFloors(s, input("right"));
    s.tick++;
    updateSurpriseFloors(s, input("left"));
    s.tick++;
    updateSurpriseFloors(s, {});
    expect(p.px).toBe(tileCenter(5) + 3 * p.speed);
    expect(p.facing).toBe("right");
  });

  it("stops ice at a wall and permits a new direction afterward", () => {
    const { s, p } = fixture("ice");
    s.grid.tiles[5 * s.grid.width + 6] = Tile.Wall;
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBe(tileCenter(5));
    s.tick++;
    updateSurpriseFloors(s, input("down"));
    expect(p.py).toBe(tileCenter(5) + p.speed);
  });

  it("does not move the same player twice on repeated updates in one tick", () => {
    const { s, p } = fixture("ice");
    updateSurpriseFloors(s, input("right"));
    const px = p.px;
    expect(updateSurpriseFloors(s, input("right"))).toEqual(new Set(["p1"]));
    expect(p.px).toBe(px);
  });

  it("bounds reverse to a temporary visit without creating a skull curse", () => {
    const { s, p } = fixture("reverse");
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBe(tileCenter(5) - p.speed);
    expect(p.curse).toBeNull();
    placePlayerAt(s, p.id, 5, 5);
    s.tick = SURPRISE_CONFIG.reverseTicks;
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBe(tileCenter(5) + p.speed);
    placePlayerAt(s, p.id, 7, 5);
    s.tick++;
    expect(updateSurpriseFloors(s, input("right"))).toEqual(new Set());
    placePlayerAt(s, p.id, 5, 5);
    s.tick++;
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBe(tileCenter(5) - p.speed);
  });

  it.each(["stun", "webbed", "shield", "charge", "rasengan", "truck", "jumpTicks", "dashTicks"] as const)("does not move a player busy with %s", field => {
    const { s, p } = fixture("ice");
    p[field] = 2;
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBe(tileCenter(5));
  });

  it("respects brace, death and existing curses without replacing them", () => {
    const { s, p } = fixture("sticky");
    p.curse = { kind: "reverse" };
    updateSurpriseFloors(s, { p1: { dir: "right", bomb: false, brace: true } });
    expect(p.px).toBe(tileCenter(5));
    s.tick++;
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBeLessThan(tileCenter(5));
    expect(p.curse).toEqual({ kind: "reverse" });
    p.alive = false;
    const px = p.px;
    s.tick++;
    updateSurpriseFloors(s, input("right"));
    expect(p.px).toBe(px);
  });
});

describe("sticky floors and kicked bombs", () => {
  function bomb(s: MatchState) {
    const b = { ownerId: "p1", x: 5, y: 5, fuse: 80, range: 2, type: "normal" as const, slide: "right" as const, offset: 32, air: null, heldBy: null };
    s.bombs.push(b);
    return s.bombs[0]!;
  }

  it("hard-stops kicked bombs, preserving fuse and owner", () => {
    const { s } = fixture("sticky");
    const b = bomb(s);
    updateSurpriseFloors(s, {});
    expect(b).toMatchObject({ slide: null, offset: 0, fuse: 80, ownerId: "p1" });
  });

  it("stops sticky bombs independently before sliding, without moving players", () => {
    const { s, p } = fixture("sticky");
    const b = bomb(s);
    stopStageStickyBombs(s);
    expect(b.slide).toBeNull();
    expect(b.offset).toBe(0);
    expect(p.px).toBe(tileCenter(5));
    b.slide = "right";
    s.stage = "classic";
    stopStageStickyBombs(s);
    expect(b.slide).toBe("right");
  });

  it("leaves airborne, held and conveyor bombs unchanged", () => {
    const { s } = fixture("sticky");
    const grounded = bomb(s);
    s.bombs = [
      { ...grounded, heldBy: "p1" },
      { ...grounded, conveyor: true },
      { ...grounded, air: { dir: "right", span: 1, tilesLeft: 1, progress: 0 } },
    ];
    const before = structuredClone(s.bombs);
    updateSurpriseFloors(s, {});
    expect(s.bombs).toEqual(before);
  });
});
