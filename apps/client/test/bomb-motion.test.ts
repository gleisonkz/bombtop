import { describe, expect, it } from "vitest";
import { CONVEYOR_SPEED, createMatch, DIR_VECTORS, Floor, FUSE_TICKS, KICK_SPEED, publicView, setTile, TILE, Tile, TICK_RATE, type Facing, type PublicView } from "@bombtop/shared";
import { smoothBombSlides } from "../src/render/bomb-motion";

const TICK_MS = 1000 / TICK_RATE;

function scene(blocked = false): PublicView {
  const s = createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 });
  if (blocked) setTile(s, 5, 5, Tile.Block);
  s.bombs.push({ ownerId: "them", x: 3, y: 5, fuse: FUSE_TICKS, range: 2, type: "normal", slide: "right", offset: 0, air: null, heldBy: null });
  return publicView(s);
}

describe("bomb motion", () => {
  it("follows a perpendicular belt without projecting onto the original kick", () => {
    const view = scene();
    view.grid.floor[5 * view.grid.width + 3] = Floor.ConveyorDown;
    const rendered = smoothBombSlides(view, view, TICK_MS * 1.5).bombs[0]!;
    expect(rendered).toMatchObject({ x: 3, y: 5, slide: "down", conveyor: true });
    expect(rendered.offset).toBeCloseTo(CONVEYOR_SPEED * 1.5);
    expect(view.bombs[0]).toMatchObject({ slide: "right", offset: 0 });
  });

  it("interpolates the fractional arrival at a center before a belt turn", () => {
    const view = scene();
    Object.assign(view.bombs[0]!, { offset: TILE - KICK_SPEED });
    view.grid.floor[5 * view.grid.width + 4] = Floor.ConveyorDown;
    view.grid.tiles[6 * view.grid.width + 4] = Tile.Empty;
    const arrival = smoothBombSlides(view, view, TICK_MS / 2).bombs[0]!;
    expect(arrival).toMatchObject({ x: 3, y: 5, slide: "right" });
    expect(arrival.offset).toBeCloseTo(TILE - KICK_SPEED / 2);
    const turn = smoothBombSlides(view, view, TICK_MS * 1.5).bombs[0]!;
    expect(turn).toMatchObject({ x: 4, y: 5, slide: "down", conveyor: true });
    expect(turn.offset).toBeCloseTo(CONVEYOR_SPEED / 2);
  });

  it("starts a resting bomb on a belt between ticks", () => {
    const view = scene();
    view.bombs[0]!.slide = null;
    view.grid.floor[5 * view.grid.width + 3] = Floor.ConveyorRight;
    expect(smoothBombSlides(view, view, TICK_MS / 2).bombs[0]).toMatchObject({ slide: "right", offset: CONVEYOR_SPEED / 2, conveyor: true });
  });

  it("finishes the fractional belt segment before stopping on normal floor", () => {
    const view = scene();
    Object.assign(view.bombs[0]!, { conveyor: true, offset: TILE - CONVEYOR_SPEED });
    view.grid.floor[5 * view.grid.width + 3] = Floor.ConveyorRight;
    const arrival = smoothBombSlides(view, view, TICK_MS / 2).bombs[0]!;
    expect(arrival).toMatchObject({ x: 3, y: 5, slide: "right", conveyor: true });
    expect(arrival.offset).toBeCloseTo(TILE - CONVEYOR_SPEED / 2);
    const stopped = smoothBombSlides(view, view, TICK_MS * 1.5).bombs[0]!;
    expect(stopped).toMatchObject({ x: 4, y: 5, offset: 0, slide: null });
    expect(stopped.conveyor).toBeUndefined();
  });

  it("reverses at a belt center without drawing a diagonal or continuing forward", () => {
    const view = scene();
    Object.assign(view.bombs[0]!, { conveyor: true, offset: TILE - CONVEYOR_SPEED });
    view.grid.floor[5 * view.grid.width + 3] = Floor.ConveyorRight;
    view.grid.floor[5 * view.grid.width + 4] = Floor.ConveyorLeft;
    expect(smoothBombSlides(view, view, TICK_MS * 1.5).bombs[0]).toMatchObject({
      x: 4, y: 5, slide: "left", offset: CONVEYOR_SPEED / 2, conveyor: true,
    });
  });
  it("renders a kicked bomb between authoritative server ticks", () => {
    const authoritative = scene();
    expect(smoothBombSlides(authoritative, authoritative, 0)).toBe(authoritative);
    expect(smoothBombSlides(authoritative, authoritative, TICK_MS / 2).bombs[0]!.offset).toBeCloseTo(KICK_SPEED / 2);
    expect(smoothBombSlides(authoritative, authoritative, TICK_MS * 1.5).bombs[0]!.offset).toBeCloseTo(KICK_SPEED * 1.5);
    const crossed = smoothBombSlides(authoritative, authoritative, TICK_MS * 8.5).bombs[0]!;
    expect([crossed.x, crossed.y]).toEqual([4, 5]);
    expect(crossed.offset).toBeCloseTo(KICK_SPEED / 2);
  });

  it("does not move through a solid obstacle", () => {
    const authoritative = scene(true);
    const moved = smoothBombSlides(authoritative, authoritative, TICK_MS * 15);
    expect(moved.bombs[0]).toMatchObject({ x: 4, y: 5, offset: 0, slide: null });
  });

  it.each(["up", "down", "left", "right"] satisfies Facing[])("keeps %s slides continuous when crossing tile centers", (direction) => {
    const authoritative = scene();
    const bomb = authoritative.bombs[0]!;
    bomb.x = 7;
    bomb.y = 5;
    bomb.slide = direction;
    const [dx, dy] = DIR_VECTORS[direction];
    const drawn = smoothBombSlides(authoritative, authoritative, TICK_MS * 8.5).bombs[0]!;
    expect([drawn.x, drawn.y]).toEqual([7 + dx, 5 + dy]);
    expect(drawn.offset).toBeCloseTo(KICK_SPEED / 2);
    expect(drawn.slide).toBe(direction);
  });

  it("never overwrites the faster position of a locally predicted kick", () => {
    const authoritative = scene();
    const predicted = { ...authoritative, bombs: [{ ...authoritative.bombs[0]!, offset: 4 * KICK_SPEED }] };
    const drawn = smoothBombSlides(authoritative, predicted, TICK_MS);
    expect(drawn.bombs[0]).toEqual(predicted.bombs[0]);
    expect(authoritative.bombs[0]!.offset).toBe(0);
  });

  it("does not advance resting bombs or their hitbox", () => {
    const authoritative = scene();
    authoritative.bombs[0]!.slide = null;
    const rendered = smoothBombSlides(authoritative, authoritative, TICK_MS * 3);
    expect(rendered).toBe(authoritative);
    expect(rendered.bombs[0]!.x * TILE).toBe(3 * TILE);
  });
});
