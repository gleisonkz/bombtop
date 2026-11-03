import { describe, expect, it } from "vitest";
import { BASE_SPEED, SPEED_STEP, type LobbyMember } from "@bombtop/shared";
import { railCards, railPlaces, speedLevel } from "../src/ui/player-rail";

const member = (id: string, extra: Partial<LobbyMember> = {}): LobbyMember =>
  ({ id, name: id, wins: 0, connected: true, character: "bomb", ...extra }) as LobbyMember;
const player = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, alive: true, bombCapacity: 1, fireRange: 2, speed: BASE_SPEED, ...extra });

describe("player rails (layout A: a card per player beside the arena, at their spawn's corner)", () => {
  it("puts each player at the side and corner they started from; the middle one between", () => {
    const places = railPlaces(
      [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 13, y: 11 },
        { id: "c", x: 13, y: 1 },
        { id: "d", x: 1, y: 11 },
        { id: "e", x: 7, y: 5 },
      ],
      15,
      13,
    );
    expect(Object.fromEntries(places)).toEqual({
      a: { side: "left", spot: "top" },
      b: { side: "right", spot: "bottom" },
      c: { side: "right", spot: "top" },
      d: { side: "left", spot: "bottom" },
      e: { side: "left", spot: "middle" },
    });
  });

  it("never puts two cards in one spot", () => {
    const places = railPlaces(
      [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 1 },
        { id: "c", x: 1, y: 2 },
      ],
      15,
      13,
    );
    const spots = [...places.values()].map((p) => `${p.side}:${p.spot}`);
    expect(new Set(spots).size).toBe(3);
    expect(places.get("a")).toEqual({ side: "left", spot: "top" });
  });

  it("counts speed in steps from the start (1 = no speed-up)", () => {
    expect(speedLevel(BASE_SPEED)).toBe(1);
    expect(speedLevel(BASE_SPEED + 2 * SPEED_STEP)).toBe(3);
  });

  it("makes a card per seat: name, who it is, rounds won, power-ups, and out when dead", () => {
    const cards = railCards(
      [member("me", { name: "Gleison", wins: 2 }), member("bot", { name: "Robô", bot: "hard", ownColors: true }), member("ana")],
      [player("me", { bombCapacity: 3, fireRange: 4, speed: BASE_SPEED + SPEED_STEP }), player("bot", { alive: false }), player("ana")],
      "me",
      3,
    );
    expect(cards.map((c) => [c.id, c.name, c.tag, c.out])).toEqual([
      ["me", "Gleison", "P1 · VOCÊ", false],
      ["bot", "Robô", "P2 · CPU", true],
      ["ana", "ana", "P3", false],
    ]);
    expect(cards[0]).toMatchObject({ wins: 2, pips: [true, true, false], bombs: 3, fire: 4, speed: 2, me: true });
    expect(cards[1]!.paint).toBeNull(); // original colors
    expect(cards[2]!.paint).toBe("#e84a4a");
  });

  it("hides rivals' power-ups from a player (only their own show); a shared screen (no 'you') sees everyone's", () => {
    const players = [player("me", { bombCapacity: 3 }), player("bot", { bombCapacity: 4 })];
    const mine = railCards([member("me"), member("bot")], players, "me", 3);
    expect(mine.map((c) => c.hidden)).toEqual([false, true]);
    const shared = railCards([member("me"), member("bot")], players, null, 3);
    expect(shared.map((c) => c.hidden)).toEqual([false, false]);
  });

  it("shows a watcher's cards with nobody as 'you', and leaves out seats not in the match", () => {
    const cards = railCards([member("a"), member("b")], [player("b")], null, 5);
    expect(cards.map((c) => [c.id, c.tag])).toEqual([["b", "P2"]]);
  });
});
