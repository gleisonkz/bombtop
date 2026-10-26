import { describe, expect, it } from "vitest";
import { AIR_TICKS_PER_TILE, createMatch, TILE } from "@bombtop/shared";
import { playerCarryPoses } from "../src/render/player-carry";
import { airLift } from "../src/render/air-arc";

function scene() {
  return createMatch({ seed: 1, playerIds: ["root", "middle", "top"], blockDensity: 0 }).players;
}

describe("player carry rendering", () => {
  it("keeps normal walking interpolation and does not mutate snapshots", () => {
    const [player] = scene();
    const before = structuredClone(player!);
    const previous = new Map([[player!.id, { px: player!.px - TILE / 2, py: player!.py }]]);
    const result = playerCarryPoses({ players: [player!], previous, alpha: 0.5, bodyHeight: () => 20 });
    expect(result[0]).toMatchObject({ x: 20, y: 24, elevated: false, carrying: false });
    expect(player).toEqual(before);
  });

  it("keeps a carried child above its thrown holder and its shadow on terrain", () => {
    const [root, child] = scene();
    Object.assign(root!, { thrown: { dir: "down", span: 3, tilesLeft: 2, progress: 3 } });
    Object.assign(child!, { heldBy: root!.id });
    const result = playerCarryPoses({ players: [child!, root!], previous: new Map(), alpha: 0, bodyHeight: () => 20 });
    expect(result[1]!.x).toBe(result[0]!.x);
    expect(result[1]!.y).toBeCloseTo(result[0]!.y - 20);
    expect(result[1]!.groundY).toBe(result[0]!.groundY);
    expect(result[0]!.y).toBeLessThan(result[0]!.groundY);
  });
  it("resolves a three-player stack independently of snapshot order", () => {
    const [root, middle, top] = scene();
    Object.assign(middle!, { heldBy: root!.id });
    Object.assign(top!, { heldBy: middle!.id });
    const players = [top!, root!, middle!];
    const result = playerCarryPoses({ players, previous: new Map(), alpha: 0.5, bodyHeight: () => 20 });
    expect(result.map(p => p.player.id)).toEqual(["root", "middle", "top"]);
    expect(result.map(p => p.y)).toEqual([24, 4, -16]);
    expect(result.map(p => p.groundY)).toEqual([24, 24, 24]);
    expect(result.map(p => p.carrying)).toEqual([true, true, false]);
    result.forEach((pose, index) => expect(pose.depth).toBeCloseTo(24 + index * 0.01));
    expect(result.map(p => p.elevated)).toEqual([false, true, true]);
  });

  it("anchors a captured player to its holder rather than stale position history", () => {
    const [root, child] = scene();
    Object.assign(child!, { heldBy: root!.id });
    const result = playerCarryPoses({ players: [root!, child!], previous: new Map([[child!.id, { px: TILE * 8, py: TILE * 8 }]]), alpha: 0, bodyHeight: () => 20 });
    expect(result[1]).toMatchObject({ x: 24, y: 4 });
  });

  it.each(["up", "down", "left", "right"] as const)("draws %s flight from its own progress with the existing arc", dir => {
    const [p] = scene();
    const thrown = { dir, span: 3, tilesLeft: 2, progress: 3 };
    Object.assign(p!, { thrown });
    const result = playerCarryPoses({ players: [p!], previous: new Map([[p!.id, { px: TILE * 8, py: TILE * 8 }]]), alpha: 0.5, bodyHeight: () => 20 })[0]!;
    const dx = dir === "right" ? 1 : dir === "left" ? -1 : 0;
    const dy = dir === "down" ? 1 : dir === "up" ? -1 : 0;
    const progress = (3 + 0.5) / AIR_TICKS_PER_TILE;
    expect(result.x).toBeCloseTo(24 + dx * 16 * progress);
    expect(result.groundY).toBeCloseTo(24 + dy * 16 * progress);
    expect(result.y).toBeCloseTo(result.groundY - airLift({ ...thrown, progress: 3.5 }));
    expect(result.elevated).toBe(true);
  });

  it("clamps late frames instead of extrapolating flight beyond the next tick", () => {
    const [p] = scene();
    Object.assign(p!, { thrown: { dir: "right", span: 3, tilesLeft: 3, progress: 0 } });
    const options = { players: [p!], previous: new Map(), bodyHeight: () => 20 };
    expect(playerCarryPoses({ ...options, alpha: 50 })).toEqual(playerCarryPoses({ ...options, alpha: 1 }));
  });

  it("does not recurse forever for an invalid or missing holder", () => {
    const [a, b] = scene();
    Object.assign(a!, { heldBy: b!.id });
    Object.assign(b!, { heldBy: a!.id });
    expect(playerCarryPoses({ players: [a!, b!], previous: new Map(), alpha: 0, bodyHeight: () => 20 })).toHaveLength(2);
    Object.assign(a!, { heldBy: "missing" });
    expect(playerCarryPoses({ players: [a!], previous: new Map(), alpha: 0, bodyHeight: () => 20 })[0]!.x).toBe(24);
  });
});
