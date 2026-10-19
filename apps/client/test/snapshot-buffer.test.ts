import { describe, expect, it } from "vitest";
import { SnapshotBuffer } from "../src/net/snapshot-buffer";

const snap = (tick: number) => ({ tick }) as never;

describe("SnapshotBuffer", () => {
  it("has nothing to show before the first snapshot", () => {
    expect(new SnapshotBuffer(100).sample(1000)).toBeNull();
  });

  it("shows a lone snapshot as-is", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(1), 1000);
    expect(b.sample(1000)).toEqual({ from: snap(1), to: snap(1), alpha: 0 });
  });

  it("interpolates between the two snapshots around now - delay", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(1), 1000);
    b.push(snap(2), 1040);
    const s = b.sample(1120)!; // render time 1020: halfway
    expect(s.from).toEqual(snap(1));
    expect(s.to).toEqual(snap(2));
    expect(s.alpha).toBeCloseTo(0.5);
  });

  it("runs a little past the newest snapshot when the next one is late, instead of freezing", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(1), 1000);
    b.push(snap(2), 1040);
    const s = b.sample(1150)!; // render time 1050: 10 ms past the newest
    expect(s.from).toEqual(snap(1));
    expect(s.to).toEqual(snap(2));
    expect(s.alpha).toBeCloseTo(1.25);
  });

  it("goes no further than half a snapshot past the newest", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(1), 1000);
    b.push(snap(2), 1040);
    expect(b.sample(5000)!.alpha).toBe(1.5);
  });

  it("starts from the oldest snapshot when render time is before it", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(1), 1000);
    b.push(snap(2), 1040);
    expect(b.sample(1000)!.from).toEqual(snap(1));
  });

  it("stays bounded", () => {
    const b = new SnapshotBuffer(100, 5);
    for (let i = 0; i < 50; i++) b.push(snap(i), i * 33);
    expect(b.size).toBe(5);
  });

  it("resets when a new match starts (tick goes backwards)", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(500), 1000);
    b.push(snap(2), 1040);
    expect(b.size).toBe(1);
    expect(b.latest).toEqual(snap(2));
  });
});
