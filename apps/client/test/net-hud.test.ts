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

describe("NetStats.report", () => {
  it("sends what the server logs: the last second's numbers and the worst snapshot gap since the last report", () => {
    const s = new NetStats();
    s.ping = 9;
    for (const at of [0, 33, 66, 200, 233]) s.arrival(at);
    for (let i = 0; i < 60; i++) s.frame(1000 / 60, i < 5, 70);
    expect(s.report("UA")).toEqual({ ping: 9, delay: 70, fps: 60, late: 5, gap: 134, slow: 17, missed: 5, work: 0, jumpMe: 0, jumpOthers: 0, ua: "UA" });
    s.arrival(266);
    expect(s.report("UA").gap).toBe(33);
  });

  it("tells the device's own stalls apart: the slowest frame and every late frame since the last report", () => {
    const s = new NetStats();
    s.frame(16, false, 50);
    s.frame(340, true, 50); // the phone froze
    for (let i = 0; i < 70; i++) s.frame(16, i < 3, 50); // a newer second, without the stall
    const r = s.report("UA");
    expect(r.slow).toBe(340);
    expect(r.missed).toBe(4);
    s.frame(16, false, 50);
    expect(s.report("UA")).toMatchObject({ slow: 16, missed: 0 });
  });

  it("tells our own code's cost apart from the browser's: the most CPU time one frame took, in tenths of a ms", () => {
    const s = new NetStats();
    s.work(2.34);
    s.work(11.06); // drawing this frame took 11 ms of our own time
    s.work(3);
    expect(s.report("UA").work).toBe(111);
    expect(s.report("UA").work).toBe(0);
  });

  it("reports the biggest jump between two frames, ours and other players', in hundredths of a tile", () => {
    const s = new NetStats();
    s.jumps(0.1, 0.2);
    s.jumps(0.05, 1.5); // someone teleported on screen
    expect(s.report("UA")).toMatchObject({ jumpMe: 10, jumpOthers: 150 });
    expect(s.report("UA")).toMatchObject({ jumpMe: 0, jumpOthers: 0 });
  });
});
