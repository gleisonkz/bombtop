import { describe, expect, it } from "vitest";
import { createMatch, diff, dropItems, FUSE_TICKS, ItemKind, patch, placeBomb, placePlayerAt, playerTile, publicView, setTile, step, Tile, type PlayerInput } from "../src";
import { center, emptyMatch, player, run } from "./helpers";

const action = (dir: PlayerInput["dir"] = "right"): PlayerInput => ({ dir, bomb: false, action: true });

function fight() {
  const s = emptyMatch();
  placePlayerAt(s, "p1", 3, 5);
  placePlayerAt(s, "p2", 4, 5);
  player(s).canPush = true;
  return s;
}

describe("push item", () => {
  it("grants a distinct ability that is not Punch", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 3, 5);
    s.items.push({ x: 3, y: 5, kind: ItemKind.Push });
    step(s);
    expect(player(s).canPush).toBe(true);
    expect(player(s).canPunch).toBe(false);
  });

  it("fills the classic battle inventory with exactly two Push items", () => {
    const battle = createMatch({ seed: 17, playerIds: ["p1", "p2"], blockDensity: 1 });
    expect(battle.items.filter((item) => item.kind === ItemKind.Push)).toHaveLength(2);
    expect(battle.items).toHaveLength(28);
  });

  it("lunges one tile and shoves an adjacent rival three tiles with intermediate movement", () => {
    const s = fight();
    step(s, { p1: action() });
    expect(player(s).px).toBeGreaterThan(center(3));
    expect(player(s, "p2").px).toBeGreaterThan(center(4));
    expect(player(s, "p2").px).toBeLessThan(center(5));
    run(s, 16);
    expect(playerTile(player(s))).toEqual({ x: 4, y: 5 });
    expect(playerTile(player(s, "p2"))).toEqual({ x: 7, y: 5 });
  });

  it("keeps the shoved player unable to act until the impulse finishes", () => {
    const s = fight();
    step(s, { p1: action() });
    run(s, 2, { p2: { dir: "left", bomb: true, action: true } });
    expect(s.bombs).toHaveLength(0);
    run(s, 20);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 7, y: 5 });
  });

  it("replays ongoing shoves and their completion through public snapshots and deltas", () => {
    const s = fight();
    const before = publicView(s);
    step(s, { p1: action() });
    const moving = publicView(s);
    expect(moving.players[0]!.shove).toMatchObject({ dir: "right", ticks: 3 });
    expect(moving.players[1]!.shove).toMatchObject({ dir: "right", ticks: 11 });
    expect(patch(before, diff(before, moving))).toEqual(moving);
    run(s, 16);
    const after = publicView(s);
    expect(after.players.every((p) => p.shove === undefined)).toBe(true);
    expect(patch(moving, diff(moving, after))).toEqual(after);
  });

  it("lets either player resist the shove while braced without moving", () => {
    const s = fight();
    step(s, { p1: action(), p2: { dir: "left", bomb: false, brace: true } });
    run(s, 16, { p2: { dir: "left", bomb: false, brace: true } });
    expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
    step(s, { p2: { dir: "left", bomb: false, brace: false } });
    expect(player(s, "p2").px).toBeLessThan(center(4));
  });

  it("does not shove through a wall or a block", () => {
    for (const obstacle of [Tile.Wall, Tile.Block]) {
      const s = fight();
      setTile(s, 5, 5, obstacle);
      step(s, { p1: action() });
      run(s, 16);
      expect(playerTile(player(s))).toEqual({ x: 3, y: 5 });
      expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
    }
  });

  it("does not push a rival into another living player", () => {
    const s = emptyMatch(["p1", "p2", "p3"]);
    placePlayerAt(s, "p1", 3, 5);
    placePlayerAt(s, "p2", 4, 5);
    placePlayerAt(s, "p3", 5, 5);
    player(s).canPush = true;
    step(s, { p1: action() });
    run(s, 12);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
  });

  it("respects a grounded bomb blocking the shove", () => {
    const s = fight();
    placePlayerAt(s, "p2", 5, 5);
    expect(placeBomb(s, "p2")).toBe(true);
    placePlayerAt(s, "p2", 4, 5);
    step(s, { p1: action() });
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
    expect(s.bombs[0]!.fuse).toBeLessThan(FUSE_TICKS);
  });

  it("can launch a bomb and push a rival with the same action", () => {
    const s = fight();
    player(s).canPunch = true;
    placePlayerAt(s, "p2", 4, 5);
    expect(placeBomb(s, "p2")).toBe(true);
    step(s, { p1: action() });
    expect(s.bombs[0]!.air).not.toBeNull();
    run(s, 16);
    expect(playerTile(player(s, "p2"))).toEqual({ x: 7, y: 5 });
  });

  it("cannot use Push while mounted", () => {
    const s = fight();
    player(s).mount = "hopper";
    step(s, { p1: action() });
    expect(playerTile(player(s, "p2"))).toEqual({ x: 4, y: 5 });
  });

  it("drops the Push power-up on death and resets the ability", () => {
    const s = fight();
    player(s).alive = false;
    dropItems(s, player(s));
    expect(s.items.some((item) => item.kind === ItemKind.Push)).toBe(true);
    expect(player(s).canPush).toBe(false);
  });
});
