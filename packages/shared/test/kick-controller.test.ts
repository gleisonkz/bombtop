import { describe, expect, it } from "vitest";
import { placeBomb, placePlayerAt, step, stopKickedBombs, tryKick } from "../src";
import { emptyMatch, player } from "./helpers";

describe("kick controller", () => {
  it("lets the kicker stop a rival's bomb without changing its explosion owner", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 3, 5);
    placePlayerAt(s, "p2", 4, 5);
    placeBomb(s, "p2");
    placePlayerAt(s, "p2", 11, 9);
    player(s).canKick = true;
    player(s, "p2").canKick = true;
    tryKick(s, player(s), "right");
    expect(s.bombs[0]!.slide).toBe("right");
    stopKickedBombs(s, player(s, "p2"));
    expect(s.bombs[0]!.slide).toBe("right");
    step(s, { p1: { dir: null, bomb: false, stopKick: true } });
    expect(s.bombs[0]!.slide).toBeNull();
    expect(s.bombs[0]!.ownerId).toBe("p2");
  });
});
