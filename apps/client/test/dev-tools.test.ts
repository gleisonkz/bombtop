import { describe, expect, it } from "vitest";
import { debugOn, liteOn, toggleDebug, toggleLite, versionLabel } from "../src/ui/dev-tools";

function memoryStore() {
  const data = new Map<string, string>();
  return { get: (k: string) => data.get(k) ?? null, set: (k: string, v: string) => void data.set(k, v) };
}

describe("debug mode", () => {
  it("is off by default", () => {
    expect(debugOn("", memoryStore())).toBe(false);
  });

  it("is on with ?debug in the address", () => {
    expect(debugOn("?debug", memoryStore())).toBe(true);
  });

  it("stays on (or off) on this device once toggled from the menu", () => {
    const store = memoryStore();
    expect(toggleDebug(store)).toBe(true);
    expect(debugOn("", store)).toBe(true);
    expect(toggleDebug(store)).toBe(false);
    expect(debugOn("", store)).toBe(false);
  });
});

describe("versionLabel", () => {
  it("shows the build's commit, short", () => {
    expect(versionLabel("5de32be1234567")).toBe("versão 5de32be");
    expect(versionLabel("dev")).toBe("versão dev");
  });
});

describe("lite mode (weak screens: smart TV browsers)", () => {
  const SAMSUNG = "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36";
  const LG = "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager";
  const PHONE = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

  it("turns on by itself in a smart TV's browser, not elsewhere", () => {
    expect(liteOn(SAMSUNG, "", memoryStore())).toBe(true);
    expect(liteOn(LG, "", memoryStore())).toBe(true);
    expect(liteOn(PHONE, "", memoryStore())).toBe(false);
  });

  it("?lite turns it on anywhere, and the menu switch overrides the guess both ways", () => {
    expect(liteOn(PHONE, "?lite", memoryStore())).toBe(true);
    const store = memoryStore();
    expect(toggleLite(SAMSUNG, store)).toBe(false);
    expect(liteOn(SAMSUNG, "", store)).toBe(false);
    expect(toggleLite(SAMSUNG, store)).toBe(true);
    expect(liteOn(SAMSUNG, "", store)).toBe(true);
    expect(toggleLite(PHONE, memoryStore())).toBe(true);
  });
});
