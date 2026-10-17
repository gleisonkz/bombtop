import { describe, expect, it } from "vitest";
import { placePlayerAt } from "../src";
import { emptyMatch, hold, player } from "./helpers";

describe("facing", () => {
  it("players start facing down", () => {
    expect(player(emptyMatch()).facing).toBe("down");
  });

  it("follows the held direction", () => {
    const s = emptyMatch();
    placePlayerAt(s, "p1", 5, 5);
    hold(s, "left", 1);
    expect(player(s).facing).toBe("left");
    hold(s, "up", 1);
    expect(player(s).facing).toBe("up");
  });

  it("turns even when blocked by a wall", () => {
    const s = emptyMatch();
    hold(s, "up", 1); // p1 at (1,1), wall above
    expect(player(s).facing).toBe("up");
  });

  it("keeps facing when no direction is held", () => {
    const s = emptyMatch();
    hold(s, "right", 1);
    hold(s, null, 3);
    expect(player(s).facing).toBe("right");
  });
});
