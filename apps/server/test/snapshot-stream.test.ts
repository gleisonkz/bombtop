import { describe, expect, it } from "vitest";
import { createMatch, patch, publicView, type Snapshot } from "@bombtop/shared";
import { KEYFRAME_EVERY, SnapshotStream } from "../src/snapshot-stream";

function snaps(n: number): Snapshot[] {
  const v = publicView(createMatch({ seed: 1, playerIds: ["a", "b"] }));
  return Array.from({ length: n }, (_, i) => {
    const s = structuredClone(v);
    s.tick = i;
    s.players[0]!.px += i * 8;
    return { ...s, acks: {} };
  });
}

describe("SnapshotStream", () => {
  it("starts with the whole snapshot, then only differences", () => {
    const stream = new SnapshotStream();
    const [a, b] = snaps(2);
    expect(stream.next(a!)).toEqual({ full: a });
    const out = stream.next(b!);
    expect("delta" in out && patch(a!, out.delta)).toEqual(b);
  });

  it("sends the whole snapshot again every KEYFRAME_EVERY snapshots", () => {
    const stream = new SnapshotStream();
    const kinds = snaps(KEYFRAME_EVERY * 2 + 1).map((s) => ("full" in stream.next(s) ? "F" : "d"));
    expect(kinds.filter((k) => k === "F")).toHaveLength(3);
    expect(kinds[KEYFRAME_EVERY]).toBe("F");
  });

  it("starts over (whole snapshot) when a new match begins", () => {
    const stream = new SnapshotStream();
    const [a, b] = snaps(2);
    stream.next(b!);
    expect(stream.next(a!)).toEqual({ full: a });
  });

  it("keeps the last snapshot sent, as the base for players who join now", () => {
    const stream = new SnapshotStream();
    const [a, b] = snaps(2);
    stream.next(a!);
    stream.next(b!);
    expect(stream.last).toEqual(b);
  });
});
