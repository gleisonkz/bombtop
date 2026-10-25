import { describe, expect, it } from "vitest";
import { createMatch, publicView, TILE, Tile, type PublicView } from "@bombtop/shared";
import { RemoteMotion } from "../src/render/remote-motion";
import type { Sample } from "../src/net/snapshot-buffer";

function frame(tick = 2, x = 896): Sample {
  const to = publicView(createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 }));
  to.tick = tick;
  to.players[1]!.px = x;
  to.players[1]!.py = TILE * 1.5;
  const from = structuredClone(to);
  from.tick -= 2;
  from.players[1]!.px -= 32;
  return { from, to, alpha: 1, pastMs: 100 };
}

const xOf = (view: PublicView) => view.players[1]!.px;

describe("remote motion recovery", () => {
  it("keeps progressing when every rendered frame gets a late snapshot", () => {
    const motion = new RemoteMotion("me");
    let previous = xOf(motion.sample(frame(), 0));
    for (let i = 1; i < 6; i++) {
      const next = frame(2 + i * 2, 896 + i * 16);
      const drawn = xOf(motion.sample(next, i * 16));
      expect(drawn).toBeGreaterThan(previous);
      previous = drawn;
    }
  });

  it("interpolates once and leaves the locally predicted player alone", () => {
    const motion = new RemoteMotion("me");
    const sample = frame();
    sample.pastMs = 0;
    sample.alpha = 0.5;
    expect(xOf(motion.sample(sample, 0))).toBe(880);
    expect(motion.sample(sample, 0).players[0]).toEqual(sample.to.players[0]);
  });

  it("settles a small correction back to the server position", () => {
    const motion = new RemoteMotion("me");
    const late = frame();
    const drawn = xOf(motion.sample(late, 0));
    const recovered = frame(4, 960);
    recovered.from = structuredClone(recovered.to);
    recovered.pastMs = 0;
    const corrected = xOf(motion.sample(recovered, 16));
    expect(corrected).toBeGreaterThan(960);
    expect(corrected).toBeLessThan(drawn);
    expect(Math.abs(xOf(motion.sample(recovered, 500)) - 960)).toBeLessThan(1);
  });

  it("snaps large corrections and new matches instead of sliding across the arena", () => {
    const motion = new RemoteMotion("me");
    motion.sample(frame(100), 0);
    const fresh = frame(2, 1664);
    fresh.from = structuredClone(fresh.to);
    fresh.pastMs = 0;
    expect(xOf(motion.sample(fresh, 16))).toBe(1664);
  });

  it("does not smooth a death or a new wall", () => {
    for (const death of [false, true]) {
      const motion = new RemoteMotion("me");
      motion.sample(frame(), 0);
      const next = frame(4, 960);
      next.from = structuredClone(next.to);
      next.pastMs = 0;
      if (death) next.to.players[1]!.alive = false;
      else next.to.grid.tiles[next.to.grid.width + 3] = Tile.Wall;
      expect(xOf(motion.sample(next, 16))).toBe(960);
    }
  });

  it("never changes authoritative positions, items, bombs or flames", () => {
    const motion = new RemoteMotion("me");
    const sample = frame();
    const original = structuredClone(sample);
    motion.sample(sample, 0);
    expect(sample).toEqual(original);
    const view = motion.sample(sample, 16);
    expect(view.bombs).toBe(sample.to.bombs);
    expect(view.flames).toBe(sample.to.flames);
    expect(view.items).toBe(sample.to.items);
  });

  it.each(["webbed", "truck"] as const)("does not smooth %s positions from the updated simulation", (status) => {
    const motion = new RemoteMotion("me");
    motion.sample(frame(), 0);
    const next = frame(4, 960);
    next.from = structuredClone(next.to);
    next.pastMs = 0;
    next.to.players[1]![status] = 5;
    expect(xOf(motion.sample(next, 16))).toBe(960);
  });
});
