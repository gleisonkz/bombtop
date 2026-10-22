import { describe, expect, it } from "vitest";
import { RoomRoute, type Address } from "../src/net/room-route";

/** A browser history kept in memory. */
function fakeAddress(start = "https://x.app/"): Address & { entries: string[] } {
  const entries = [start];
  return {
    entries,
    get href() {
      return entries[entries.length - 1]!;
    },
    push: (url) => void entries.push(url),
    replace: (url) => void (entries[entries.length - 1] = url),
    back: () => void entries.pop(),
  };
}

describe("RoomRoute", () => {
  it("puts the room in the address when entering, as a new history entry", () => {
    const a = fakeAddress();
    new RoomRoute(a).entered("abc123");
    expect(a.entries).toEqual(["https://x.app/", "https://x.app/sala/abc123"]);
  });

  it("keeps the entry when the address already names the room (reload or invite link)", () => {
    const a = fakeAddress("https://x.app/sala/abc123");
    new RoomRoute(a).entered("abc123");
    expect(a.entries).toEqual(["https://x.app/sala/abc123"]);
  });

  it("clears the room from the address when leaving", () => {
    const a = fakeAddress();
    const r = new RoomRoute(a);
    r.entered("abc123");
    r.left();
    expect(a.href).toBe("https://x.app/");
  });

  it("a TV watching puts /tv/ in the address, so a reload watches again", () => {
    const a = fakeAddress();
    const r = new RoomRoute(a);
    r.entered("abc123", true);
    expect(a.href).toBe("https://x.app/tv/abc123");
    expect(r.wentBack()).toBe(false);
    r.left();
    expect(a.href).toBe("https://x.app/");
  });

  it("tells when the address no longer names the room (back button)", () => {
    const a = fakeAddress();
    const r = new RoomRoute(a);
    expect(r.wentBack()).toBe(false);
    r.entered("abc123");
    expect(r.wentBack()).toBe(false);
    a.entries.pop();
    expect(r.wentBack()).toBe(true);
  });
});
