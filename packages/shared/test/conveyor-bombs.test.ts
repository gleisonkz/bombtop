import { describe, expect, it } from "vitest";
import { CONVEYOR_SPEED, DIR_VECTORS, Floor, hasFlame, ItemKind, KICK_SPEED, launch, placeBomb, placePlayerAt, setTile, step, stopKickedBombs, TILE, Tile, updateSlides, type Facing } from "../src";
import { emptyMatch, player, run } from "./helpers";

const floors = { up: Floor.ConveyorUp, down: Floor.ConveyorDown, left: Floor.ConveyorLeft, right: Floor.ConveyorRight };
function scene(dir: Facing = "right") {
  const s = emptyMatch();
  placePlayerAt(s, "p1", 5, 5);
  placeBomb(s, "p1");
  placePlayerAt(s, "p1", 1, 1);
  s.grid.floor[5 * s.grid.width + 5] = floors[dir];
  return { s, b: s.bombs[0]! };
}

describe("bombs on conveyor belts", () => {
  it.each(["up", "down", "left", "right"] as const)("carries a resting bomb %s at belt speed and stops at the first normal tile", dir => {
    const { s, b } = scene(dir);
    updateSlides(s);
    expect(b.slide).toBe(dir);
    expect(b.offset).toBe(CONVEYOR_SPEED);
    for (let i = 1; i <= TILE / CONVEYOR_SPEED; i++) updateSlides(s);
    const [dx, dy] = DIR_VECTORS[dir];
    expect([b.x, b.y, b.offset, b.slide]).toEqual([5 + dx, 5 + dy, 0, null]);
  });

  it("turns at tile centers and continues across consecutive belts", () => {
    const { s, b } = scene();
    s.grid.floor[5 * s.grid.width + 6] = Floor.ConveyorDown;
    setTile(s, 6, 6, Tile.Empty);
    for (let i = 0; i < TILE / CONVEYOR_SPEED; i++) updateSlides(s);
    expect([b.x, b.y, b.offset]).toEqual([6, 5, 0]);
    updateSlides(s);
    expect([b.slide, b.offset]).toEqual(["down", CONVEYOR_SPEED]);
  });

  it.each(["wall", "block", "bomb", "player"])("stops at a %s and resumes when the path clears", obstacle => {
    const { s, b } = scene();
    if (obstacle === "wall") setTile(s, 6, 5, Tile.Wall);
    if (obstacle === "block") setTile(s, 6, 5, Tile.Block);
    if (obstacle === "bomb") s.bombs.push({ ...b, x: 6 });
    if (obstacle === "player") placePlayerAt(s, "p2", 6, 5);
    updateSlides(s);
    expect([b.x, b.offset, b.slide]).toEqual([5, 0, null]);
    setTile(s, 6, 5, Tile.Empty);
    s.bombs = [b];
    placePlayerAt(s, "p2", 13, 11);
    updateSlides(s);
    expect(b.offset).toBe(CONVEYOR_SPEED);
  });

  it("does not drag airborne or held bombs", () => {
    const { s, b } = scene();
    b.heldBy = "p1";
    updateSlides(s);
    expect([b.slide, b.offset]).toEqual([null, 0]);
    b.heldBy = null;
    launch(b, "right");
    updateSlides(s);
    expect([b.slide, b.offset]).toEqual([null, 0]);
  });

  it("finishes a kicked segment before following the belt direction", () => {
    const { s, b } = scene("down");
    b.slide = "right";
    b.offset = TILE - KICK_SPEED;
    s.grid.floor[5 * s.grid.width + 6] = Floor.ConveyorLeft;
    updateSlides(s);
    expect([b.x, b.offset]).toEqual([6, 0]);
    updateSlides(s);
    expect([b.slide, b.offset]).toEqual(["left", CONVEYOR_SPEED]);
  });

  it("does not stop a conveyor by pressing the kick-stop button", () => {
    const { s, b } = scene();
    player(s).canKick = true;
    updateSlides(s);
    stopKickedBombs(s, player(s));
    expect([b.slide, b.offset]).toEqual(["right", CONVEYOR_SPEED]);
  });

  it("keeps the fuse running and explodes at the transported tile", () => {
    const { s, b } = scene();
    b.range = 0;
    b.fuse = TILE / CONVEYOR_SPEED + 1;
    run(s, b.fuse);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 6, 5)).toBe(true);
    expect(hasFlame(s, 5, 5)).toBe(false);
  });

  it("destroys an item carried under the bomb", () => {
    const { s } = scene();
    s.items = [{ x: 6, y: 5, kind: ItemKind.Fire }];
    run(s, TILE / CONVEYOR_SPEED);
    expect(s.items).toHaveLength(0);
  });

  it("detonates when carried into existing fire", () => {
    const { s, b } = scene();
    b.range = 0;
    b.offset = TILE - CONVEYOR_SPEED;
    b.slide = "right";
    Object.assign(b, { conveyor: true });
    s.flames = [{ x: 6, y: 5, ttl: 10, ownerId: "p2" }];
    step(s);
    expect(s.bombs).toHaveLength(0);
    expect(hasFlame(s, 6, 5)).toBe(true);
  });

  it("prevents opposite belts sending two bombs into the same tile", () => {
    const { s, b } = scene();
    s.grid.floor[5 * s.grid.width + 7] = Floor.ConveyorLeft;
    const other = { ...b, x: 7 };
    s.bombs.push(other);
    for (let i = 0; i <= TILE / CONVEYOR_SPEED; i++) {
      updateSlides(s);
      const distance = (other.x - b.x) * TILE - other.offset - b.offset;
      expect(distance).toBeGreaterThanOrEqual(TILE);
    }
    expect(new Set(s.bombs.map(bomb => `${bomb.x},${bomb.y}`)).size).toBe(2);
  });

  it("starts transporting a newly placed bomb in the same simulation tick", () => {
    const { s } = scene();
    s.bombs = [];
    placePlayerAt(s, "p1", 5, 5);
    step(s, { p1: { dir: null, bomb: true } });
    expect(s.bombs[0]!.offset).toBe(CONVEYOR_SPEED);
  });
});
