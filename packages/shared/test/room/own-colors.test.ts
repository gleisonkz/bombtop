import { describe, expect, it } from "vitest";
import { BattleSession, createMatch, firstPickers, publicView } from "../../src";

const own = (s: BattleSession) =>
  s
    .lobbyInfo("X")
    .members.filter((m) => m.ownColors)
    .map((m) => m.id);

describe("firstPickers", () => {
  it("gives each character's original colors to the first in the list who has it", () => {
    const picks = [
      { id: "a", character: "captain" },
      { id: "b", character: "goku" },
      { id: "c", character: "captain" },
      { id: "d", character: "goku" },
      { id: "e", character: "thor" },
    ] as const;
    expect([...firstPickers(picks)]).toEqual(["a", "b", "e"]);
  });
});

describe("own colors in the lobby", () => {
  it("everyone on a character nobody else picked keeps its original colors", () => {
    const s = new BattleSession();
    s.join("a", "A", "captain");
    s.join("b", "B", "goku");
    expect(own(s)).toEqual(["a", "b"]);
  });

  it("the second to pick a taken character wears their seat color", () => {
    const s = new BattleSession();
    s.join("a", "A", "goku");
    s.join("b", "B", "captain");
    s.setCharacter("b", "goku");
    expect(own(s)).toEqual(["a"]);
  });

  it("goes by when they picked, not by seat: a later seat that picked first keeps the originals", () => {
    const s = new BattleSession();
    s.join("a", "A", "captain");
    s.join("b", "B", "goku");
    s.setCharacter("a", "goku");
    expect(own(s)).toEqual(["b"]);
  });

  it("when the first picker switches away (or leaves), the next in pick order takes the originals", () => {
    const s = new BattleSession();
    s.join("a", "A", "goku");
    s.join("b", "B", "goku");
    s.join("c", "C", "goku");
    expect(own(s)).toEqual(["a"]);
    s.setCharacter("a", "thor");
    expect(own(s)).toEqual(["a", "b"]);
    s.leave("b");
    expect(own(s)).toEqual(["a", "c"]);
  });

  it("picking the character one already has keeps their place in line", () => {
    const s = new BattleSession();
    s.join("a", "A", "goku");
    s.join("b", "B", "goku");
    s.setCharacter("a", "goku");
    expect(own(s)).toEqual(["a"]);
  });

  it("bots count as pickers", () => {
    const s = new BattleSession({ random: () => 0 });
    s.join("a", "A", "bomb");
    s.addBot("a", "easy"); // a character nobody plays: the captain
    expect(s.members[1]!.character).toBe("captain");
    expect(own(s)).toEqual(["a", "bot-1"]);
    s.setCharacter("a", "captain"); // the bot picked the captain first
    expect(own(s)).toEqual(["bot-1"]);
  });
});

describe("own colors in the match", () => {
  it("each player carries whether they wear their character's original colors, also in what clients see", () => {
    const s = new BattleSession({ seed: () => 1 });
    s.join("a", "A", "goku");
    s.join("b", "B", "captain");
    s.join("c", "C", "captain");
    s.setCharacter("b", "thor");
    s.setCharacter("b", "captain"); // now after c
    s.start("a");
    const view = publicView(s.match!);
    expect(view.players.map((p) => [p.id, !!p.ownColors])).toEqual([
      ["a", true],
      ["b", false],
      ["c", true],
    ]);
  });

  it("without a pick order, createMatch goes by seat: the first seat with a character has its originals", () => {
    const m = createMatch({ seed: 1, playerIds: ["a", "b", "c"], characters: { a: "goku", b: "goku", c: "thor" } });
    expect(m.players.map((p) => !!p.ownColors)).toEqual([true, false, true]);
  });
});
