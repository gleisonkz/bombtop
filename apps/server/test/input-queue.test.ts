import { describe, expect, it } from "vitest";
import type { PlayerInput } from "@bombtop/shared";
import { InputQueue } from "../src/input-queue";

const go = (dir: PlayerInput["dir"], bomb = false): PlayerInput => ({ dir, bomb });

/** Runs the queue for `ticks` server ticks from `from`, returning the direction applied on each. */
function run(q: InputQueue, from: number, ticks: number) {
  const dirs: PlayerInput["dir"][] = [];
  for (let t = from; t < from + ticks; t++) dirs.push(q.take(t).dir);
  return dirs;
}

describe("InputQueue", () => {
  it("applies an untimed input at once and keeps it held", () => {
    const q = new InputQueue();
    q.push(go("right"), 1, undefined, 0);
    expect(run(q, 0, 3)).toEqual(["right", "right", "right"]);
    expect(q.ack).toEqual({ seq: 1, ticks: 3 });
  });

  it("holds each input for exactly as many ticks as the client did, even when a message arrives late", () => {
    const q = new InputQueue();
    // Client: right at its tick 100, down at 110, stop at 115. Latency 5 ticks, but "down" arrives 4 ticks late.
    q.push(go("right"), 1, 100, 105);
    const applied: PlayerInput["dir"][] = [];
    for (let now = 105; now < 140; now++) {
      if (now === 119) q.push(go("down"), 2, 110, now);
      if (now === 121) q.push(go(null), 3, 115, now);
      applied.push(q.take(now).dir);
    }
    const count = (d: PlayerInput["dir"]) => applied.filter((x) => x === d).length;
    // The late message stretched the offset once; from then on durations match the client's.
    expect(count("down")).toBe(5);
    expect(applied.indexOf("down")).toBeGreaterThan(applied.indexOf("right"));
    expect(applied.at(-1)).toBe(null);
  });

  it("with steady latency, every input lasts exactly its client duration", () => {
    const q = new InputQueue();
    const plan: [PlayerInput["dir"], number][] = [["right", 0], ["down", 7], ["left", 9], [null, 20]];
    plan.forEach(([dir, t], i) => q.push(go(dir), i + 1, t, t + 6));
    const applied = run(q, 6, 30);
    expect(applied.filter((d) => d === "right")).toHaveLength(7);
    expect(applied.filter((d) => d === "down")).toHaveLength(2);
    expect(applied.filter((d) => d === "left")).toHaveLength(11);
  });

  it("keeps inputs in the client's order even if they arrive swapped, and ignores stale ones", () => {
    const q = new InputQueue();
    q.push(go("up"), 2, 4, 7);
    q.push(go(null), 1, 0, 7); // older, arrived after
    const applied = run(q, 7, 10);
    expect(applied.at(-1)).toBe("up");
    expect(applied.slice(applied.indexOf("up"))).not.toContain(null);
    q.push(go("down"), 1, 0, 17); // a duplicate of something long applied
    expect(run(q, 17, 3)).toEqual(["up", "up", "up"]);
  });

  it("fires a bomb press once, on the tick its input is due", () => {
    const q = new InputQueue();
    q.push(go(null), 1, 0, 3);
    q.push(go(null, true), 2, 4, 4);
    const bombs = Array.from({ length: 12 }, (_, i) => q.take(3 + i).bomb);
    expect(bombs.filter(Boolean)).toHaveLength(1);
    expect(bombs.indexOf(true)).toBe(5); // client tick 4 + 4-tick delay = server tick 8
  });

  it("acks the latest input it has applied and for how long", () => {
    const q = new InputQueue();
    q.push(go("up"), 4, 10, 12);
    q.push(go("left"), 5, 13, 14);
    run(q, 13, 3); // ticks 13..15: "up" only (left is due at 16)
    expect(q.ack).toEqual({ seq: 4, ticks: 3 });
    run(q, 16, 2);
    expect(q.ack).toEqual({ seq: 5, ticks: 2 });
  });

  it("lets the delay shrink back once the network calms down, while standing still", () => {
    const q = new InputQueue();
    q.push(go(null), 1, 0, 30); // one very late message
    run(q, 30, 1);
    for (let t = 1; t < 400; t++) {
      const client = 2 * t + 28;
      q.push(go(t % 2 ? "right" : null), t + 1, client, client + 3);
      run(q, client + 3, 2);
    }
    expect(q.delay).toBeLessThan(10);
  });
});
