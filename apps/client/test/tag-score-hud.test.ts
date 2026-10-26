import { describe, expect, it } from "vitest";
import { createMatch, publicView } from "@bombtop/shared";
import { Renderer } from "../src/render/renderer";

describe("TAG team indicators on the arena scoreboard", () => {
  it("renders each teammate color and clears badges on Single or leaving", () => {
    const renderer = new Renderer(true);
    const state = createMatch({ seed: 21, blockDensity: 0, playerIds: ["a", "b", "c"] });
    const internals = renderer as unknown as {
      drawScore(state: ReturnType<typeof publicView>): void;
      scoreTeams: Map<string, { text: string; visible: boolean }>;
    };
    renderer.setScore([
      { id: "a", wins: 2, team: "red" },
      { id: "b", wins: 1, team: "blue" },
      { id: "c", wins: 2, team: "red" },
    ]);
    internals.drawScore(publicView(state));
    expect(internals.scoreTeams.get("a")?.text).toBe("VERM");
    expect(internals.scoreTeams.get("b")?.text).toBe("AZUL");
    expect(internals.scoreTeams.get("c")?.text).toBe("VERM");
    renderer.setScore([{ id: "a", wins: 0 }, { id: "b", wins: 0 }, { id: "c", wins: 0 }]);
    internals.drawScore(publicView(state));
    expect([...internals.scoreTeams.values()].every(badge => !badge.visible)).toBe(true);
    renderer.setScore(null);
    expect(internals.scoreTeams.size).toBe(0);
  });
});
