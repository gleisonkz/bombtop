import { describe, expect, it } from "vitest";
import { Sound, type AudioBackend } from "../src/audio/sound";

/** Records what would reach the speakers. */
function fakeBackend() {
  const played: { name: string; gain: number; pan: number; rate: number }[] = [];
  let unlocked = 0;
  const backend: AudioBackend = {
    unlock: async () => void unlocked++,
    play: (name, o) => void played.push({ name, ...o }),
    now: () => 0,
  };
  return { backend, played, unlocks: () => unlocked };
}

function memoryStore() {
  const data = new Map<string, string>();
  return { get: (k: string) => data.get(k) ?? null, set: (k: string, v: string) => void data.set(k, v) };
}

describe("Sound", () => {
  it("plays cues panned by position, louder for bigger explosions", () => {
    const { backend, played } = fakeBackend();
    const s = new Sound(backend, memoryStore(), () => 0.5);
    s.cues([{ name: "explode", x: 13, size: 1 }, { name: "explode", x: 0, size: 9 }], 13);
    expect(played).toHaveLength(2);
    expect(played[0]!.pan).toBeCloseTo(0.6);
    expect(played[1]!.pan).toBeCloseTo(-0.6);
    expect(played[1]!.gain).toBeGreaterThan(played[0]!.gain);
  });

  it("stays quiet while muted and remembers the choice", () => {
    const store = memoryStore();
    const { backend, played } = fakeBackend();
    new Sound(backend, store).toggleMute();
    const again = new Sound(backend, store);
    expect(again.muted).toBe(true);
    again.play("click");
    expect(played).toHaveLength(0);
  });

  it("drops copies past the voice limit", () => {
    const { backend, played } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    for (let i = 0; i < 10; i++) s.play("place");
    expect(played.length).toBeLessThan(10);
    expect(played.length).toBeGreaterThan(0);
  });

  it("varies pitch a little so repeats do not sound robotic", () => {
    const { backend, played } = fakeBackend();
    new Sound(backend, memoryStore(), () => 0).play("kick");
    new Sound(backend, memoryStore(), () => 0.999).play("kick");
    expect(played[0]!.rate).toBeLessThan(1);
    expect(played[1]!.rate).toBeGreaterThan(1);
  });

  it("unlocks audio once, on the first user gesture", async () => {
    const { backend, unlocks } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    await s.unlock();
    await s.unlock();
    expect(unlocks()).toBe(1);
  });
});
