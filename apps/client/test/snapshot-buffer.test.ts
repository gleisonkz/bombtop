import { describe, expect, it } from "vitest";
import { SnapshotBuffer } from "../src/net/snapshot-buffer";

const snap = (tick: number) => ({ tick }) as never;
/** Server time of a tick (60 Hz), in ms. */
const ms = (tick: number) => (tick * 1000) / 60;

describe("SnapshotBuffer", () => {
  it("has nothing to show before the first snapshot", () => {
    expect(new SnapshotBuffer(100).sample(1000)).toBeNull();
  });

  it("shows a lone snapshot as-is", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(60), 1000);
    expect(b.sample(1000)).toEqual({ from: snap(60), to: snap(60), alpha: 0, pastMs: 0 });
  });

  it("interpolates between the two snapshots around now - delay", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(60), 1000);
    b.push(snap(62), 1000 + ms(2));
    const s = b.sample(1100 + ms(1))!; // halfway
    expect(s.from).toEqual(snap(60));
    expect(s.to).toEqual(snap(62));
    expect(s.alpha).toBeCloseTo(0.5);
  });

  it("places snapshots by server time, so a late burst still lands where each belongs", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(60), 1000);
    b.push(snap(62), 1100); // held up by the network...
    b.push(snap(64), 1101); // ...then arriving together with the next one
    const s = b.sample(1100 + ms(3))!; // halfway from tick 62 to 64
    expect(s.from).toEqual(snap(62));
    expect(s.to).toEqual(snap(64));
    expect(s.alpha).toBeCloseTo(0.5);
  });

  it("says how far past the newest snapshot it is when the next one is late", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(60), 1000);
    b.push(snap(62), 1000 + ms(2));
    const s = b.sample(1150)!;
    expect(s.from).toEqual(snap(60));
    expect(s.to).toEqual(snap(62));
    expect(s.alpha).toBe(1);
    expect(s.pastMs).toBeCloseTo(50 - ms(2));
  });

  it("starts from the oldest snapshot when render time is before it", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(60), 1000);
    b.push(snap(62), 1000 + ms(2));
    expect(b.sample(1000)!.from).toEqual(snap(60));
  });

  it("stays bounded", () => {
    const b = new SnapshotBuffer(100, 5);
    for (let i = 0; i < 50; i++) b.push(snap(i * 2), i * 33);
    expect(b.size).toBe(5);
  });

  it("resets when a new match starts (tick goes backwards)", () => {
    const b = new SnapshotBuffer(100);
    b.push(snap(500), 1000);
    b.push(snap(2), 1040);
    expect(b.size).toBe(1);
    expect(b.latest).toEqual(snap(2));
    expect(b.sample(1120)).toEqual({ from: snap(2), to: snap(2), alpha: 0, pastMs: 0 });
  });
});
