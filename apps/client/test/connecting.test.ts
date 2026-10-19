import { describe, expect, it } from "vitest";
import { connectingText } from "../src/ui/connecting";

describe("connecting message", () => {
  it("says it is connecting right away", () => {
    expect(connectingText(0)).toBe("Conectando…");
  });

  it("explains a slow start: the free server is waking up", () => {
    expect(connectingText(4000)).toMatch(/acordando/i);
    expect(connectingText(4000)).toMatch(/1 minuto/);
  });

  it("keeps the player company on a long wait", () => {
    expect(connectingText(30000)).toMatch(/quase/i);
  });
});
