import { describe, expect, it } from "vitest";
import { Standings } from "../src/game/standings";

const alive = (...ids: string[]) => (all: string[]) => all.map((id) => ({ id, alive: ids.includes(id) }));
const ALL = ["a", "b", "c", "d"];

describe("Standings", () => {
  it("ranks the winner first, then whoever died last", () => {
    const s = new Standings();
    s.see(alive("a", "b", "c", "d")(ALL), 10);
    s.see(alive("a", "c", "d")(ALL), 20); // b out first
    s.see(alive("a", "c")(ALL), 30); // then d
    s.see(alive("a")(ALL), 40); // then c
    expect(s.ranking(ALL, "a")).toEqual([
      { id: "a", place: 1 },
      { id: "c", place: 2 },
      { id: "d", place: 3 },
      { id: "b", place: 4 },
    ]);
  });

  it("players who die on the same tick share a place", () => {
    const s = new Standings();
    s.see(alive("a", "b", "c")(["a", "b", "c"]), 1);
    s.see(alive()(["a", "b", "c"]), 5); // all three at once: a draw
    expect(s.ranking(["a", "b", "c"], null)).toEqual([
      { id: "a", place: 1 },
      { id: "b", place: 1 },
      { id: "c", place: 1 },
    ]);
  });

  it("a player brought back (revenge cart) counts only their last death", () => {
    const s = new Standings();
    s.see(alive("a", "b", "c")(["a", "b", "c"]), 1);
    s.see(alive("a", "c")(["a", "b", "c"]), 2); // b dies
    s.see(alive("b", "c")(["a", "b", "c"]), 3); // b swaps back in, a dies
    s.see(alive("c")(["a", "b", "c"]), 4); // b dies again
    expect(s.ranking(["a", "b", "c"], "c").map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("forgets the last match when a new one starts", () => {
    const s = new Standings();
    s.see(alive("a")(["a", "b"]), 9);
    s.reset();
    s.see(alive("a", "b")(["a", "b"]), 0);
    s.see(alive("b")(["a", "b"]), 3);
    expect(s.ranking(["a", "b"], "b")).toEqual([
      { id: "b", place: 1 },
      { id: "a", place: 2 },
    ]);
  });

  it("someone never seen dead (left the room) goes last", () => {
    const s = new Standings();
    s.see(alive("a", "b")(["a", "b"]), 1);
    s.see(alive("a")(["a", "b"]), 2);
    expect(s.ranking(["a", "b", "x"], "a").map((r) => r.id)).toEqual(["a", "b", "x"]);
  });
});
