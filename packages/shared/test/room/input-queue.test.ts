import { describe, expect, it } from "vitest";
import type { PlayerInput } from "../../src";
import { InputQueue } from "../../src";

const go = (dir: PlayerInput["dir"], bomb = false): PlayerInput => ({ dir, bomb });

/** Runs the queue for `ticks` server ticks from `from`, returning the direction applied on each. */
function run(q: InputQueue, from: number, ticks: number) {
  const dirs: PlayerInput["dir"][] = [];
  for (let t = from; t < from + ticks; t++) dirs.push(q.take(t).dir);
  return dirs;
}

describe("InputQueue", () => {
  it("drains overdue movement even when a new direction arrives every tick", () => {
    const q = new InputQueue();
    let seq = 0;
    for (let t = 0; t < 20; t++) q.push(go(t % 2 ? "down" : "right"), ++seq, t, 100);
    for (let now = 140; now < 240; now++) {
      q.push(go(now % 2 ? "down" : "right"), ++seq, now - 120, now);
      q.take(now);
    }
    expect(q.ack.seq).toBeGreaterThanOrEqual(seq - 2);
  });

  it("gradually recovers a 21-tick offset during continuous movement", () => {
    const q = new InputQueue();
    q.push(go("right"), 1, 0, 20);
    let seq = 1;
    let previous = q.delay;
    let lastCut = -6;
    const applied: number[] = [];
    for (let now = 20; now < 400; now++) {
      if (now >= 24 && now % 4 === 0) {
        q.push(go(seq % 2 ? "down" : "right"), ++seq, now - 3, now);
      }
      q.take(now);
      expect(previous - q.delay).toBeGreaterThanOrEqual(0);
      expect(previous - q.delay).toBeLessThanOrEqual(1);
      if (q.delay < previous) {
        expect(now - lastCut).toBeGreaterThanOrEqual(6);
        lastCut = now;
      }
      if (now === 199) expect(q.delay).toBe(21);
      previous = q.delay;
      if (q.ack.seq !== applied.at(-1)) applied.push(q.ack.seq);
    }
    expect(q.delay).toBe(4);
    expect(applied.filter((value) => value > 0)).toEqual(
      Array.from({ length: q.ack.seq }, (_, i) => i + 1),
    );
    expect(q.ack.seq).toBeGreaterThan(seq - 3);
  });

  it("plays an overdue burst one transition per tick without merging taps", () => {
    const q = new InputQueue();
    const inputs: PlayerInput[] = [
      { dir: "right", alt: "up", bomb: true, action: true, special: true, hold: true },
      go("down"),
      { dir: "left", bomb: true, action: true, special: true, hold: true },
      go(null),
    ];
    inputs.forEach((input, i) => q.push(input, i + 1, i, 20));
    for (let i = 0; i < inputs.length; i++) {
      expect(q.take(40 + i)).toMatchObject(inputs[i]!);
      expect(q.ack).toEqual({ seq: i + 1, ticks: 1 });
    }
    expect(q.take(44)).toMatchObject({ dir: null, bomb: false, action: false });
    expect(q.ack).toEqual({ seq: 4, ticks: 2 });
  });

  it("preserves separate untimed taps arriving between simulation ticks", () => {
    const q = new InputQueue();
    q.push(go("right", true), 1, undefined, 0);
    q.push(go(null), 2, undefined, 0);
    q.push(go("left", true), 3, undefined, 0);
    expect(q.take(0)).toMatchObject({ dir: "right", bomb: true });
    expect(q.take(1)).toMatchObject({ dir: null, bomb: false });
    expect(q.take(2)).toMatchObject({ dir: "left", bomb: true });
    expect(q.take(3).bomb).toBe(false);
  });

  it("keeps the offset finite when all idle lag samples expire", () => {
    const q = new InputQueue();
    q.push(go(null), 1, 0, 20);
    run(q, 20, 220);
    expect(Number.isFinite(q.delay)).toBe(true);
    q.push(go("right"), 2, 237, 240);
    run(q, 240, 150);
    expect(q.delay).toBe(4);
    expect(q.ack.seq).toBe(2);
  });

  it("rejects applied stale sequences before recording their lateness", () => {
    const q = new InputQueue();
    q.push(go("right"), 1, 100, 103);
    run(q, 103, 2);
    q.push(go("left"), 1, 0, 105);
    expect(q.delay).toBe(4);
    q.push(go("down"), 2, 103, 106);
    expect(q.delay).toBe(4);
    expect(q.take(107).dir).toBe("down");
  });

  it("rejects pending duplicate sequences before recording their lateness", () => {
    const q = new InputQueue();
    q.push(go("right"), 1, 100, 103);
    q.push(go("left"), 1, 0, 103);
    expect(q.delay).toBe(4);
    q.push(go("down"), 2, 101, 104);
    expect(q.delay).toBe(4);
    expect(run(q, 104, 2)).toEqual(["right", "down"]);
  });

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

  it("keeps the bomb button held until the input that lets it go (glove carry)", () => {
    const q = new InputQueue();
    q.push({ dir: null, bomb: true, hold: true }, 1, undefined, 0);
    expect(q.take(0)).toMatchObject({ bomb: true, hold: true });
    expect(q.take(1)).toMatchObject({ bomb: false, hold: true });
    q.push({ dir: "left", bomb: false, hold: true }, 2, undefined, 2);
    expect(q.take(2).hold).toBe(true);
    q.push(go(null), 3, undefined, 3);
    expect(q.take(3).hold).toBeFalsy();
  });

  it("fires a special press once, like a bomb", () => {
    const q = new InputQueue();
    q.push({ dir: null, bomb: false, special: true }, 1, undefined, 0);
    expect(q.take(0).special).toBe(true);
    expect(q.take(1).special).toBeFalsy();
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
