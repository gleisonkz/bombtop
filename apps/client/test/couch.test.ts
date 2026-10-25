import { describe, expect, it } from "vitest";
import { C2S, type CharacterId } from "@bombtop/shared";
import { CouchSeats, type Pad } from "../src/input/couch";
import type { PadState } from "../src/input/gamepad";
import type { RoomLink } from "../src/net/room-link";

/** A pad with these buttons held (standard mapping: 0 A, 1 B, 3 Y, 12-15 d-pad). */
const pad = (...held: number[]): PadState => ({ buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: held.includes(i) })), axes: [0, 0] });

/** A fake room: records who sat down and what each seat sent. */
function room(capacity = 5) {
  const seats: { name: string; character: string; sent: [string, unknown][]; left: boolean }[] = [];
  const host = {
    seat(name: string, character: string): RoomLink | null {
      if (seats.filter((s) => !s.left).length >= capacity) return null;
      const s = { name, character, sent: [] as [string, unknown][], left: false };
      seats.push(s);
      return {
        sessionId: `s${seats.length}`,
        roomId: "offline",
        reconnectionToken: "",
        send: (type, message) => void s.sent.push([type, message]),
        onMessage: () => undefined,
        onLeave: () => undefined,
        ping: () => undefined,
        leave: async () => void (s.left = true),
      };
    },
  };
  return { host, seats };
}

describe("couch seats", () => {
  it("leaves the first controller to player one and seats any other that presses A", () => {
    const { host, seats } = room();
    let pads: Pad[] = [
      { index: 0, state: pad(0) },
      { index: 1, state: pad() },
    ];
    const couch = new CouchSeats(host, () => pads);
    couch.tick("lobby", ["bomb"]);
    expect(seats).toEqual([]);
    pads = [pads[0]!, { index: 1, state: pad(0) }];
    couch.tick("lobby", ["bomb"]);
    expect(seats.map((s) => s.name)).toEqual(["Controle 2"]);
    couch.tick("lobby", ["bomb"]);
    expect(seats).toHaveLength(1); // holding A does not seat it twice
  });

  it("gives a new seat a character nobody has yet", () => {
    const { host, seats } = room();
    const couch = new CouchSeats(host, () => [{ index: 0, state: pad() }, { index: 1, state: pad(0) }]);
    couch.tick("lobby", ["bomb", "captain"]);
    expect(seats[0]!.character).toBe("thor");
  });

  it("two controllers joining at once get different characters", () => {
    const { host, seats } = room();
    const couch = new CouchSeats(host, () => [{ index: 0, state: pad() }, { index: 1, state: pad(0) }, { index: 2, state: pad(0) }]);
    couch.tick("lobby", ["bomb"]);
    expect(seats.map((s) => s.character)).toEqual(["captain", "thor"]);
  });

  it("in the lobby, Y changes the seat's character and B gives the seat up", () => {
    const { host, seats } = room();
    let state = pad(0);
    const couch = new CouchSeats(host, () => [{ index: 0, state: pad() }, { index: 1, state }]);
    const taken: CharacterId[] = ["bomb"];
    couch.tick("lobby", taken);
    state = pad();
    couch.tick("lobby", taken);
    state = pad(3);
    couch.tick("lobby", taken);
    expect(seats[0]!.sent).toEqual([[C2S.character, { character: "thor" }]]);
    state = pad(1);
    couch.tick("lobby", taken);
    expect(seats[0]!.left).toBe(true);
    expect(couch.size).toBe(0);
  });

  it("in a match, sends the pad's input when it changes, numbered", () => {
    const { host, seats } = room();
    let state = pad(0);
    const couch = new CouchSeats(host, () => [{ index: 0, state: pad() }, { index: 1, state }]);
    couch.tick("lobby", ["bomb"]);
    state = pad(15); // d-pad right
    couch.tick("playing", ["bomb"]);
    couch.tick("playing", ["bomb"]);
    state = pad(15, 0); // and A: a bomb
    couch.tick("playing", ["bomb"]);
    const inputs = seats[0]!.sent.filter(([t]) => t === C2S.input).map(([, m]) => m);
    expect(inputs).toEqual([
      { dir: "right", bomb: false, action: false, seq: 1 },
      { dir: "right", bomb: true, action: false, hold: true, seq: 2 },
    ]);
  });

  it("a controller unplugged gives its seat up", () => {
    const { host, seats } = room();
    let pads: Pad[] = [{ index: 0, state: pad() }, { index: 1, state: pad(0) }];
    const couch = new CouchSeats(host, () => pads);
    couch.tick("lobby", ["bomb"]);
    pads = [pads[0]!];
    couch.tick("playing", ["bomb"]);
    expect(seats[0]!.left).toBe(true);
  });

  it("no new seats once the match is on, nor when the room is full", () => {
    const { host, seats } = room(1);
    let a = pad(0);
    const couch = new CouchSeats(host, () => [{ index: 0, state: pad() }, { index: 1, state: a }, { index: 2, state: a }]);
    couch.tick("playing", ["bomb"]);
    expect(seats).toHaveLength(0);
    a = pad();
    couch.tick("lobby", ["bomb"]);
    a = pad(0);
    couch.tick("lobby", ["bomb"]);
    expect(seats).toHaveLength(1);
  });

  it("Start on any controller starts the match from the lobby", () => {
    const { host } = room();
    let started = 0;
    let p1 = pad();
    const couch = new CouchSeats(host, () => [{ index: 0, state: p1 }], () => started++);
    couch.tick("lobby", ["bomb"]);
    p1 = pad(9);
    couch.tick("lobby", ["bomb"]);
    couch.tick("lobby", ["bomb"]);
    expect(started).toBe(1);
    p1 = pad();
    couch.tick("playing", ["bomb"]);
    p1 = pad(9);
    couch.tick("playing", ["bomb"]);
    expect(started).toBe(1);
  });

  it("leaving the room gives every seat up", () => {
    const { host, seats } = room();
    const couch = new CouchSeats(host, () => [{ index: 0, state: pad() }, { index: 1, state: pad(0) }, { index: 2, state: pad(0) }]);
    couch.tick("lobby", ["bomb"]);
    couch.leaveAll();
    expect(seats.map((s) => s.left)).toEqual([true, true]);
  });
});
