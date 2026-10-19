import { describe, expect, it } from "vitest";
import { debugOn, toggleDebug, versionLabel } from "../src/ui/dev-tools";

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
