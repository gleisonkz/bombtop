import { describe, expect, it } from "vitest";
import { ItemKind } from "../src/state";
import {
  SB4_STAGE_DEFINITIONS,
  SB4_STAGE_ITEM_KINDS,
  SB4_STAGE_SOURCE,
  type Sb4StageItemKind,
} from "../src/sb4-stage-definitions";

const expectedItemKinds = [
  ItemKind.Bomb,
  ItemKind.Fire,
  ItemKind.FullFire,
  ItemKind.Speed,
  ItemKind.Egg,
  ItemKind.Glove,
  ItemKind.Punch,
  "push",
  ItemKind.Kick,
  ItemKind.Skull,
  "honey",
] as const satisfies readonly Sb4StageItemKind[];

const expectedNames = [
  "Usual",
  "Fast 'n Slow",
  "Rolling Sugedama",
  "Push and Fall",
  "Numb Bomb",
  "Surprise Floor",
  "Hide and Blow Seek",
  "Spinny Slots",
  "Seesaw",
  "Costume/Cosplay",
  "Trolley",
  "Flag Tag",
] as const;

const documentedStages = [
  [1, [8, 5, 0, 3, 2, 2, 2, 2, 3, 1, 0], 28],
  [2, [10, 6, 0, 2, 2, 3, 0, 2, 3, 1, 0], 29],
  [3, [10, 5, 1, 5, 2, 2, 2, 3, 2, 1, 0], 33],
  [4, [6, 5, 0, 3, 0, 3, 2, 5, 2, 0, 0], 26],
  [6, [10, 6, 1, 3, 2, 2, 2, 2, 3, 1, 0], 32],
  [7, [10, 6, 1, 4, 2, 0, 1, 3, 5, 1, 0], 33],
  [9, [10, 6, 0, 3, 0, 3, 3, 3, 3, 1, 0], 32],
  [10, [10, 6, 0, 5, 0, 0, 0, 0, 3, 1, 8], 33],
  [11, [10, 6, 0, 3, 2, 3, 2, 3, 3, 1, 0], 33],
  [12, [10, 7, 0, 6, 0, 0, 0, 0, 3, 1, 0], 27],
] as const;

describe("Super Bomberman 4 Battle Mode stage definitions", () => {
  it("covers all 12 numbered stages in their documented order", () => {
    expect(SB4_STAGE_DEFINITIONS).toHaveLength(12);
    expect(SB4_STAGE_DEFINITIONS.map((stage) => stage.number)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(SB4_STAGE_DEFINITIONS.map((stage) => stage.name)).toEqual(expectedNames);
    expect(new Set(SB4_STAGE_DEFINITIONS.map((stage) => stage.number)).size).toBe(12);
  });

  it("identifies the original source as player observations rather than ROM extraction", () => {
    expect(SB4_STAGE_SOURCE).toMatchObject({
      code: "O",
      evidence: "player-observation",
      url: "https://game.bad-person.net/gamenote/superbom4/superbom4_item_battle.html",
      conditions: {
        humanPlayers: 5,
        com: "normal",
        battle: 3,
        time: "infinite",
        otherOptions: "off",
      },
    });
  });

  it("exposes precisely the eleven documented Battle Mode item kinds", () => {
    expect(SB4_STAGE_ITEM_KINDS).toEqual(expectedItemKinds);
    expect(new Set(SB4_STAGE_ITEM_KINDS).size).toBe(expectedItemKinds.length);
    expect(SB4_STAGE_ITEM_KINDS).not.toContain(ItemKind.Remote);
    expect(SB4_STAGE_ITEM_KINDS).not.toContain(ItemKind.Pierce);
    expect(SB4_STAGE_ITEM_KINDS).not.toContain(ItemKind.Picanha);
  });

  for (const [number, counts, total] of documentedStages) {
    it(`preserves the observed item counts and known total of stage ${number}`, () => {
      const stage = SB4_STAGE_DEFINITIONS.find((entry) => entry.number === number);
      expect(stage?.kind).toBe("documented");
      if (stage?.kind !== "documented") return;

      expect(Object.keys(stage.itemCounts).sort()).toEqual([...expectedItemKinds].sort());
      expect(expectedItemKinds.map((kind) => stage.itemCounts[kind])).toEqual(counts);
      expect(Object.values(stage.itemCounts).every((count) => Number.isInteger(count) && count >= 0)).toBe(true);
      expect(Object.values(stage.itemCounts).reduce<number>((sum, count) => sum + count, 0)).toBe(total);
      expect(stage.knownTotal).toBe(total);
    });
  }

  it.each([
    [5, "unreported"],
    [8, "roulette"],
  ] as const)("marks stage %i as special (%s) without inventing counts", (number, variant) => {
    const stage = SB4_STAGE_DEFINITIONS.find((entry) => entry.number === number);
    expect(stage).toMatchObject({ kind: "special", variant, itemCounts: null, knownTotal: null });
  });

  it("distinguishes ten documented inventories from two special variants", () => {
    expect(SB4_STAGE_DEFINITIONS.filter((stage) => stage.kind === "documented")).toHaveLength(10);
    expect(SB4_STAGE_DEFINITIONS.filter((stage) => stage.kind === "special")).toHaveLength(2);
    expect(SB4_STAGE_DEFINITIONS.reduce((sum, stage) => sum + (stage.knownTotal ?? 0), 0)).toBe(306);
  });
});
