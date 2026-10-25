import { describe, expect, it } from "vitest";
import { FreezeWatch } from "../src/net/freeze-watch";

describe("FreezeWatch (a main thread that stopped answering)", () => {
  it("reports a freeze once the page's beats stop for the limit, with what it was doing", () => {
    const w = new FreezeWatch(5000);
    w.beat(0, "lobby", "/sala/AB12");
    for (let t = 1000; t < 5000; t += 1000) expect(w.check(t)).toBeNull();
    expect(w.check(5000)).toEqual({ kind: "freeze", ms: 5000, crumb: "lobby", path: "/sala/AB12" });
    expect(w.check(6000)).toBeNull();
  });

  it("reports how long it was stuck when the beats come back", () => {
    const w = new FreezeWatch(5000);
    w.beat(0, "lobby", "/");
    for (let t = 1000; t <= 6000; t += 1000) w.check(t);
    expect(w.beat(9000, "lobby", "/")).toEqual({ kind: "unfreeze", ms: 9000, crumb: "lobby", path: "/" });
    expect(w.beat(10000, "lobby", "/")).toBeNull();
  });

  it("keeps quiet while the page is in the background", () => {
    const w = new FreezeWatch(5000);
    w.beat(0, "menu", "/");
    w.away();
    for (let t = 1000; t <= 60000; t += 1000) expect(w.check(t)).toBeNull();
    expect(w.beat(61000, "menu", "/")).toBeNull();
    expect(w.check(62000)).toBeNull();
  });

  it("does not take a sleeping device (its own checks stopped too) for a freeze", () => {
    const w = new FreezeWatch(5000);
    w.beat(0, "menu", "/");
    w.check(1000);
    expect(w.check(60000)).toBeNull();
    expect(w.check(61000)).toBeNull();
  });

  it("stops reporting after a few freezes", () => {
    const w = new FreezeWatch(5000);
    let t = 0;
    let freezes = 0;
    let unfreezes = 0;
    for (let i = 0; i < 20; i++) {
      if (w.beat(t, "match", "/")?.kind === "unfreeze") unfreezes++;
      for (let k = 0; k < 6; k++) if (w.check((t += 1000))?.kind === "freeze") freezes++;
    }
    expect(freezes).toBe(5);
    expect(unfreezes).toBe(5);
  });
});
