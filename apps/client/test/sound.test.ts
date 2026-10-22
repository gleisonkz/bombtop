import { describe, expect, it } from "vitest";
import { MASTER_DB, SOUNDS, Sound, resultSound, type AudioBackend } from "../src/audio/sound";

/** Records what would reach the speakers. */
function fakeBackend() {
  const played: { name: string; gain: number; pan: number; rate: number }[] = [];
  const stopped: string[] = [];
  let unlocked = 0;
  const backend: AudioBackend = {
    unlock: async () => void unlocked++,
    play: (name, o) => {
      played.push({ name, ...o });
      return { stop: () => void stopped.push(name) };
    },
    now: () => 0,
  };
  return { backend, played, stopped, unlocks: () => unlocked };
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

  it("scales everything by the volume, kept between visits", () => {
    const store = memoryStore();
    const { backend, played } = fakeBackend();
    const s = new Sound(backend, store);
    expect(s.volume).toBe(1);
    s.play("click");
    s.setVolume(0.25);
    s.play("click");
    expect(played[1]!.gain).toBeCloseTo(played[0]!.gain * 0.25);
    expect(new Sound(backend, store).volume).toBe(0.25);
  });

  it("clamps the volume and treats zero as silence", () => {
    const { backend, played } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    s.setVolume(7);
    expect(s.volume).toBe(1);
    s.setVolume(-1);
    expect(s.volume).toBe(0);
    s.play("click");
    expect(played).toHaveLength(0);
  });

  it("ignores a broken stored volume", () => {
    const store = memoryStore();
    store.set("bombtop.volume", "loud");
    expect(new Sound(fakeBackend().backend, store).volume).toBe(1);
  });

  it("drops copies past the voice limit", () => {
    const { backend, played } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    for (let i = 0; i < 10; i++) s.play("place");
    expect(played.length).toBeLessThan(10);
    expect(played.length).toBeGreaterThan(0);
  });

  it("plays the whole mix MASTER_DB quieter", () => {
    const { backend, played } = fakeBackend();
    new Sound(backend, memoryStore()).play("click");
    expect(MASTER_DB).toBe(-2);
    expect(played[0]!.gain).toBeCloseTo(SOUNDS.click.gain * 10 ** (-2 / 20));
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

  it("cuts the sound still playing on the same channel", () => {
    const { backend, played, stopped } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    s.play("bomb-pick", { channel: "pick" });
    s.play("ninja-pick", { channel: "pick" });
    expect(played.map((p) => p.name)).toEqual(["bomb-pick", "ninja-pick"]);
    expect(stopped).toEqual(["bomb-pick"]);
  });

  it("leaves sounds outside the channel alone", () => {
    const { backend, stopped } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    s.play("click");
    s.play("bomb-pick", { channel: "pick" });
    s.play("ninja-pick", { channel: "pick" });
    expect(stopped).toEqual(["bomb-pick"]);
  });

  it("cuts the channel even when the new sound is muted", () => {
    const { backend, stopped } = fakeBackend();
    const s = new Sound(backend, memoryStore());
    s.play("bomb-pick", { channel: "pick" });
    s.toggleMute();
    s.play("ninja-pick", { channel: "pick" });
    expect(stopped).toEqual(["bomb-pick"]);
  });
});

describe("resultSound", () => {
  it("cheers the winner, consoles the others and calls a tie", () => {
    expect(resultSound("me", "me")).toBe("win");
    expect(resultSound("rival", "me")).toBe("lose");
    expect(resultSound(null, "me")).toBe("draw");
    expect(["win", "lose", "draw"].every((n) => n in SOUNDS)).toBe(true);
  });
});
