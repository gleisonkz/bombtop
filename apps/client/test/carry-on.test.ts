import { describe, expect, it } from "vitest";
import { createMatch, publicView, TILE, type PublicView } from "@bombtop/shared";
import { carryOn, MAX_CARRY_MS } from "../src/net/carry-on";

const CENTER = TILE + TILE / 2; // middle of tile 1

/** Two snapshots with player "a" at the middle of tile (1,1), having come from `dx, dy` away. */
function moved(dx: number, dy: number): { from: PublicView; to: PublicView } {
  const to = publicView(createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 }));
  const a = to.players.find((p) => p.id === "a")!;
  a.px = CENTER;
  a.py = CENTER;
  const from = structuredClone(to);
  const fa = from.players.find((p) => p.id === "a")!;
  fa.px -= dx;
  fa.py -= dy;
  return { from, to };
}

const posOf = (v: PublicView) => {
  const a = v.players.find((p) => p.id === "a")!;
  return { px: a.px, py: a.py };
};

describe("carryOn", () => {
  it.each([{ heldBy: "b" }, { thrown: { dir: "right", span: 3, tilesLeft: 3, progress: 0 } }])("does not extrapolate cargo or flight: %j", status => {
    const { from, to } = moved(32, 0);
    Object.assign(to.players[0]!, status);
    expect(carryOn(from, to, 100).players[0]).toEqual(to.players[0]);
  });
  it("keeps a walking player walking the same way while the next snapshot is late", () => {
    const { from, to } = moved(32, 0);
    expect(posOf(carryOn(from, to, 100))).toEqual({ px: CENTER + 6 * 16, py: CENTER });
  });

  it("stops at walls like the game does", () => {
    const { from, to } = moved(0, -32); // walking up, into the border wall
    expect(posOf(carryOn(from, to, 200))).toEqual({ px: CENTER, py: CENTER });
  });

  it("leaves standing players and teleports alone", () => {
    expect(posOf(carryOn(moved(0, 0).from, moved(0, 0).to, 200))).toEqual({ px: CENTER, py: CENTER });
    const { from, to } = moved(3 * TILE, 0);
    expect(posOf(carryOn(from, to, 200))).toEqual({ px: CENTER, py: CENTER });
  });

  it("guesses no further than MAX_CARRY_MS", () => {
    const { from, to } = moved(32, 0);
    expect(carryOn(from, to, 10_000)).toEqual(carryOn(from, to, MAX_CARRY_MS));
  });

  it("leaves the snapshots untouched", () => {
    const { from, to } = moved(32, 0);
    const before = structuredClone(to);
    carryOn(from, to, 100);
    expect(to).toEqual(before);
  });

  it.each(["stun", "webbed", "shield", "charge", "rasengan", "truck", "jumpTicks", "dashTicks"] as const)("does not extrapolate %s movement", (status) => {
    const { from, to } = moved(32, 0);
    to.players[0]![status] = 5;
    expect(posOf(carryOn(from, to, 150))).toEqual(posOf(to));
  });

  it("does not extrapolate a mounted player", () => {
    const { from, to } = moved(32, 0);
    to.players[0]!.mount = "dasher";
    expect(posOf(carryOn(from, to, 150))).toEqual(posOf(to));
  });
});
