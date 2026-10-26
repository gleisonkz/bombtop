import { describe, expect, it } from "vitest";
import { createMatch, hurt, publicView } from "@bombtop/shared";
import { Renderer } from "../src/render/renderer";

describe("Maniac health in the arena score bar", () => {
  it("shows player HP, changes after damage and hides it in normal Single battles", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 2, blockDensity: 0, playerIds: ["p1", "p2"], startingHitPoints: { p1: 4, p2: 2 } });
    renderer.setScore([{ id: "p1", wins: 1 }, { id: "p2", wins: 0 }]);
    const internal = renderer as unknown as {
      drawScore(state: ReturnType<typeof publicView>): void;
      scoreHp: Map<string, { text: string; visible: boolean }>;
    };
    internal.drawScore(publicView(state));
    expect(internal.scoreHp.get("p1")?.text).toBe("♥4");
    expect(internal.scoreHp.get("p2")?.text).toBe("♥2");
    hurt(state.players[0]!);
    internal.drawScore(publicView(state));
    expect(internal.scoreHp.get("p1")?.text).toBe("♥3");
    internal.drawScore(publicView(createMatch({ seed: 2, blockDensity: 0, playerIds: ["p1", "p2"] })));
    expect(internal.scoreHp.get("p1")?.visible).toBe(false);
  });
});
