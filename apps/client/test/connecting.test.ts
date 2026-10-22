import { describe, expect, it } from "vitest";
import { connectingText } from "../src/ui/connecting";

describe("connecting message", () => {
  it("says it is connecting right away", () => {
    expect(connectingText(0)).toBe("Conectando…");
  });

  it("calls a slow start a slow connection, not a sleeping server (ours never sleeps)", () => {
    expect(connectingText(4000)).toMatch(/lenta/i);
    expect(connectingText(4000)).not.toMatch(/acordando|dormi/i);
  });

  it("points at the internet on a long wait", () => {
    expect(connectingText(30000)).toMatch(/internet/i);
    expect(connectingText(30000)).not.toMatch(/acordar/i);
  });
});
