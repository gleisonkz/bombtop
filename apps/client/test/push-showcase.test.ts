import { describe, expect, it } from "vitest";
import { ItemKind, TILE } from "@bombtop/shared";
import { Showcase } from "../src/game/showcase";

describe("Push showcase", () => {
  it("demonstrates the rival being moved by the Push ability", () => {
    const demo = new Showcase(ItemKind.Push);
    let maxSeparation = 0;
    for (let tick = 0; tick < demo.length; tick++) {
      demo.advance();
      const you = demo.state.players.find((p) => p.id === "you")!;
      const rival = demo.state.players.find((p) => p.id === "rival")!;
      maxSeparation = Math.max(maxSeparation, Math.abs(rival.px - you.px));
    }
    expect(maxSeparation).toBeGreaterThanOrEqual(3 * TILE);
  });
});
