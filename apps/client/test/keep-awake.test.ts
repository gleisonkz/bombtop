import { describe, expect, it } from "vitest";
import { KeepAwake } from "../src/net/keep-awake";

describe("KeepAwake", () => {
  it("asks for a beat once nothing has been sent for a while", () => {
    const k = new KeepAwake(50);
    k.sent(0);
    expect(k.due(30)).toBe(false);
    expect(k.due(50)).toBe(true);
  });

  it("any message sent counts: walking around sends inputs, no beats needed", () => {
    const k = new KeepAwake(50);
    k.sent(0);
    k.sent(40); // an input
    expect(k.due(80)).toBe(false);
    expect(k.due(90)).toBe(true);
  });

  it("is due at once before anything was sent", () => {
    expect(new KeepAwake(50).due(0)).toBe(true);
  });
});
