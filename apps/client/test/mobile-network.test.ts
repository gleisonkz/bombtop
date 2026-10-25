import { describe, expect, it } from "vitest";
import { createMatch, InputQueue, publicView, step, TICK_RATE, type PlayerInput, type Snapshot } from "@bombtop/shared";
import { AdaptiveDelay } from "../src/net/adaptive-delay";
import { Predictor } from "../src/net/prediction";
import { SnapshotBuffer } from "../src/net/snapshot-buffer";
import { RemoteMotion } from "../src/render/remote-motion";

interface Profile {
  name: string;
  base: number;
  stall: number;
}

function exercise(profile: Profile) {
  const state = createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 });
  const queue = new InputQueue();
  const predictor = new Predictor("me");
  const delay = new AdaptiveDelay();
  const buffer = new SnapshotBuffer(delay.ms);
  const motion = new RemoteMotion("me");
  const inputs: { due: number; t: number; seq: number; input: PlayerInput }[] = [];
  const snapshots: { due: number; snap: Snapshot }[] = [];
  let lastInputAt = 0;
  let lastSnapshotAt = 0;
  let latest: Snapshot | null = null;
  let lateFrames = 0;
  let sent = 0;
  let drawn = 0;
  const applied: number[] = [];
  for (let tick = 0; tick < 1000; tick++) {
    const directions = ["right", "down", "left", "up"] as const;
    const input = { dir: directions[Math.floor(tick / 24) % directions.length]!, bomb: false };
    const t = predictor.clock;
    const seq = predictor.step(input);
    if (seq !== null) {
      const stall = tick >= 120 && tick < 120 + profile.stall ? 120 + profile.stall - tick : 0;
      lastInputAt = Math.max(lastInputAt, tick + profile.base + stall);
      inputs.push({ due: lastInputAt, t, seq, input });
      sent++;
    }
    while (inputs[0] && inputs[0].due <= tick) {
      const next = inputs.shift()!;
      queue.push(next.input, next.seq, next.t, tick);
    }
    const command = queue.take(tick);
    if (queue.ack.seq > 0 && queue.ack.seq !== applied.at(-1)) applied.push(queue.ack.seq);
    step(state, { me: command, them: { dir: tick % 96 < 48 ? "left" : "right", bomb: false } });
    if (tick % 2 === 0) {
      const phase = tick % 180;
      const held = tick >= 180 && tick < 600 && phase < profile.stall ? profile.stall - phase : 0;
      lastSnapshotAt = Math.max(lastSnapshotAt, tick + profile.base + held);
      snapshots.push({ due: lastSnapshotAt, snap: { ...structuredClone(publicView(state)), acks: { me: queue.ack } } });
    }
    while (snapshots[0] && snapshots[0].due <= tick) {
      latest = snapshots.shift()!.snap;
      predictor.reconcile(latest);
      delay.observe(tick * 1000 / TICK_RATE);
      buffer.delayMs = delay.ms;
      buffer.push(latest, tick * 1000 / TICK_RATE);
    }
    const sample = buffer.sample(tick * 1000 / TICK_RATE);
    if (sample) {
      if (sample.pastMs > 0) lateFrames++;
      const before = structuredClone(sample);
      const view = motion.sample(sample, tick * 1000 / TICK_RATE);
      expect(sample).toEqual(before);
      expect(view.players.every((p) => Number.isFinite(p.px) && Number.isFinite(p.py))).toBe(true);
      drawn++;
    }
    if (latest) {
      expect(predictor.lead(latest)).toBeLessThanOrEqual(12);
      expect(predictor.predict(latest)?.alive).toBe(true);
    }
  }
  return { delay: delay.ms, inputDelay: queue.delay, applied, sent, lateFrames, drawn };
}

describe("mobile network recovery with real simulation and input acknowledgements", () => {
  it.each<Profile>([
    { name: "Wi-Fi with a 200 ms delivery burst", base: 2, stall: 12 },
    { name: "4G with 400 ms delivery bursts", base: 5, stall: 24 },
  ])("recovers after $name", (profile) => {
    const result = exercise(profile);
    expect(result.inputDelay).toBeLessThanOrEqual(profile.base + 1);
    expect(result.delay).toBeLessThan(180);
    expect(result.applied).toEqual(Array.from({ length: result.applied.length }, (_, i) => i + 1));
    expect(result.applied.length).toBeGreaterThanOrEqual(result.sent - 1);
    expect(result.lateFrames).toBeGreaterThan(0);
    expect(result.drawn).toBeGreaterThan(950);
  });
});
