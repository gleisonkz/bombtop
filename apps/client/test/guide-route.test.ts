import { describe, expect, it } from "vitest";
import { GuideRoute } from "../src/net/guide-route";
import type { Address } from "../src/net/room-route";

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

describe("GuideRoute", () => {
  it("tells whether the address is the item guide", () => {
    expect(new GuideRoute(fakeAddress()).isOpen()).toBe(false);
    expect(new GuideRoute(fakeAddress("https://x.app/itens")).isOpen()).toBe(true);
    expect(new GuideRoute(fakeAddress("https://x.app/itens/")).isOpen()).toBe(true);
    expect(new GuideRoute(fakeAddress("https://x.app/sala/abc")).isOpen()).toBe(false);
  });

  it("opens the guide as a new history entry", () => {
    const a = fakeAddress();
    new GuideRoute(a).opened();
    expect(a.entries).toEqual(["https://x.app/", "https://x.app/itens"]);
  });

  it("keeps the entry when the address already is the guide (reload or shared link)", () => {
    const a = fakeAddress("https://x.app/itens");
    new GuideRoute(a).opened();
    expect(a.entries).toEqual(["https://x.app/itens"]);
  });

  it("closing goes back to the entry it came from, so the back button does not return to the guide", () => {
    const a = fakeAddress();
    const r = new GuideRoute(a);
    r.opened();
    r.closed();
    expect(a.entries).toEqual(["https://x.app/"]);
  });

  it("closing a guide the page was opened on swaps it for the menu", () => {
    const a = fakeAddress("https://x.app/itens?debug=1");
    const r = new GuideRoute(a);
    r.opened();
    r.closed();
    expect(a.entries).toEqual(["https://x.app/?debug=1"]);
  });

  it("does nothing on close when the address already left the guide (back button)", () => {
    const a = fakeAddress();
    const r = new GuideRoute(a);
    r.opened();
    a.entries.pop();
    r.closed();
    expect(a.entries).toEqual(["https://x.app/"]);
  });
});

describe("GuideRoute for another page", () => {
  it("keeps the character guide at /personagens the same way", () => {
    const a = fakeAddress();
    const r = new GuideRoute(a, "/personagens");
    expect(r.isOpen()).toBe(false);
    r.opened();
    expect(a.entries).toEqual(["https://x.app/", "https://x.app/personagens"]);
    expect(r.isOpen()).toBe(true);
    expect(new GuideRoute(a).isOpen()).toBe(false);
    r.closed();
    expect(a.entries).toEqual(["https://x.app/"]);
  });
});
