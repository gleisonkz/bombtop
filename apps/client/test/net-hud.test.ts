import { describe, expect, it } from "vitest";
import { NetStats } from "../src/ui/net-hud";

describe("NetStats", () => {
  it("sums up a second of frames: fps, frames shown past the newest snapshot, delay and ping", () => {
    const s = new NetStats();
    s.ping = 7;
    for (let i = 0; i < 60; i++) s.frame(1000 / 60, i < 3, 52.4);
    expect(s.summary()).toBe("ping 7 ms · atraso 52 ms · 60 fps · 3 quadros sem snapshot");
  });

  it("starts each second over", () => {
    const s = new NetStats();
    for (let i = 0; i < 60; i++) s.frame(1000 / 60, true, 40);
    for (let i = 0; i < 30; i++) s.frame(1000 / 30, false, 40);
    expect(s.summary()).toContain("30 fps · 0 quadros");
  });

  it("shows a dash before the first ping comes back", () => {
    expect(new NetStats().summary()).toContain("ping – ms");
  });
});
