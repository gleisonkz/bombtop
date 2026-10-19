import { describe, expect, it } from "vitest";
import { botInput, createMatch, DeltaReceiver, diff, patch, publicView, step, type PlayerInput } from "../src";

describe("diff / patch", () => {
  it("rebuilds the next value exactly from the previous one and the difference", () => {
    const a = { x: 1, y: { z: 2, w: [1, 2, 3] }, list: [{ id: "a", px: 1 }], gone: true };
    const b = { x: 1, y: { z: 5, w: [1, 9, 3] }, list: [{ id: "a", px: 4 }], added: "hi" };
    expect(patch(a, diff(a, b))).toEqual(b);
  });

  it("is empty when nothing changed", () => {
    const a = { x: 1, y: [1, 2] };
    expect(diff(a, structuredClone(a))).toEqual({});
  });

  it("sends only what changed: a moved player is a couple of numbers, not the whole state", () => {
    const a = publicView(createMatch({ seed: 1, playerIds: ["a", "b", "c", "d", "e"] }));
    const b = structuredClone(a);
    b.tick++;
    b.players[0]!.px += 12;
    const d = diff(a, b);
    expect(JSON.stringify(d).length).toBeLessThan(60);
    expect(patch(a, d)).toEqual(b);
  });

  it("replaces lists that grew or shrank (new bombs, flames)", () => {
    const a = { bombs: [{ x: 1 }] };
    const b = { bombs: [{ x: 1 }, { x: 2 }] };
    expect(patch(a, diff(a, b))).toEqual(b);
    expect(patch(b, diff(b, a))).toEqual(a);
  });

  it("does not touch the value it patches", () => {
    const a = { x: { y: 1 } };
    const before = structuredClone(a);
    patch(a, diff(a, { x: { y: 2 } }));
    expect(a).toEqual(before);
  });

  it("follows whole bot matches tick by tick, and stays small", () => {
    for (const seed of [1, 2, 3]) {
      const s = createMatch({ seed, playerIds: ["a", "b", "c", "d", "e"] });
      let prev = publicView(s);
      let full = 0;
      let sent = 0;
      for (let t = 0; t < 1500 && s.players.filter((p) => p.alive).length > 1; t++) {
        const inputs: Record<string, PlayerInput> = {};
        for (const p of s.players) inputs[p.id] = botInput(s, p.id, "hard");
        step(s, inputs);
        if (t % 2) continue; // snapshots go out every other tick
        const next = publicView(s);
        const d = diff(prev, next);
        expect(patch(prev, d)).toEqual(next);
        full += JSON.stringify(next).length;
        sent += JSON.stringify(d).length;
        prev = next;
      }
      expect(sent).toBeLessThan(full * 0.2);
    }
  });
});

describe("DeltaReceiver", () => {
  it("rebuilds each snapshot from the whole one and the differences after it", () => {
    const r = new DeltaReceiver<{ tick: number; x: number }>();
    expect(r.delta(diff({ tick: 0, x: 0 }, { tick: 1, x: 1 }))).toBeNull(); // nothing to apply it to yet
    expect(r.full({ tick: 1, x: 1 })).toEqual({ tick: 1, x: 1 });
    expect(r.delta(diff({ tick: 1, x: 1 }, { tick: 2, x: 5 }))).toEqual({ tick: 2, x: 5 });
    expect(r.delta(diff({ tick: 2, x: 5 }, { tick: 3, x: 6 }))).toEqual({ tick: 3, x: 6 });
  });
});
