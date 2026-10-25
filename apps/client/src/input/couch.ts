import { C2S, CHARACTERS, type CharacterId, type LobbyInfo, type PlayerInput } from "@bombtop/shared";
import type { RoomLink } from "../net/room-link";
import { GamepadInput, type PadState } from "./gamepad";

/** A connected controller: the browser's index for it (stable while plugged in) and its state. */
export interface Pad {
  index: number;
  state: PadState;
}

/** Where couch seats come from (LocalHost.seat). */
export interface CouchHost {
  seat(name: string, character: string): RoomLink | null;
}

const A = 0;
const B = 1;
const Y = 3;
const START = 9;

/** The connected controllers, in the browser's order. */
export function connectedPads(): Pad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  return navigator.getGamepads().flatMap((p) => (p?.connected ? [{ index: p.index, state: p }] : []));
}

interface Seat {
  link: RoomLink;
  character: CharacterId;
  input: GamepadInput;
  last: string;
  seq: number;
}

/**
 * Couch play: more players on this same screen, one per controller. The first controller is player
 * one's (with the keyboard); any other joins by pressing A in the lobby, Y changes its character and B
 * gives its seat up; Start on any controller starts the match. In a match each sends its own input over its
 * seat, as a player online would.
 */
export class CouchSeats {
  private readonly seats = new Map<number, Seat>();
  /** Each pad as last read, to tell a press from a hold. */
  private readonly before = new Map<number, PadState>();

  constructor(
    private readonly host: CouchHost,
    private readonly pads: () => Pad[] = connectedPads,
    /** Starts the match (the host's start button). */
    private readonly start: () => void = () => {},
  ) {}

  /** How many controllers have a seat. */
  get size(): number {
    return this.seats.size;
  }

  /** One tick: seats come and go in the lobby, and send their input in a match. */
  tick(phase: LobbyInfo["phase"] | null, taken: readonly CharacterId[]): void {
    const pads = this.pads();
    const present = new Set(pads.map((p) => p.index));
    // Our own seats count as taken before the room's lobby says so (two may join in one tick).
    const inUse = [...taken, ...[...this.seats.values()].map((s) => s.character)];
    for (const [index, seat] of this.seats) {
      if (!present.has(index)) this.free(index, seat);
    }
    pads.forEach(({ index, state }, order) => {
      const was = this.before.get(index);
      this.before.set(index, state);
      const pressed = (b: number) => !!state.buttons[b]?.pressed && !was?.buttons[b]?.pressed;
      if (phase === "lobby" && pressed(START)) this.start();
      if (order === 0) return; // player one's
      const seat = this.seats.get(index);
      if (!seat) {
        if (phase === "lobby" && pressed(A)) this.sit(index, order + 1, inUse);
        return;
      }
      if (phase === "playing") return this.play(seat);
      seat.input.sample(); // keeps its presses and holds current for the next match
      if (phase !== "lobby") return;
      if (pressed(B)) return this.free(index, seat);
      if (pressed(Y)) {
        seat.character = CHARACTERS[(CHARACTERS.indexOf(seat.character) + 1) % CHARACTERS.length]!;
        seat.link.send(C2S.character, { character: seat.character });
      }
    });
  }

  /** Every seat leaves (the room is closing). */
  leaveAll(): void {
    for (const [index, seat] of this.seats) this.free(index, seat);
  }

  private sit(index: number, n: number, taken: CharacterId[]): void {
    const character = CHARACTERS.find((c) => !taken.includes(c)) ?? CHARACTERS[n % CHARACTERS.length]!;
    taken.push(character);
    const link = this.host.seat(`Controle ${n}`, character);
    if (!link) return;
    const input = new GamepadInput(() => this.pads().find((p) => p.index === index)?.state ?? null);
    input.sample(); // the A that seated it is not a bomb
    this.seats.set(index, { link, character, input, last: "", seq: 0 });
  }

  /** Sends the pad's input when it changes (the room keeps a held direction). */
  private play(seat: Seat): void {
    const input: PlayerInput = seat.input.sample();
    const key = JSON.stringify(input);
    if (key === seat.last && !input.bomb && !input.action && !input.special) return;
    seat.last = key;
    seat.link.send(C2S.input, { ...input, seq: ++seat.seq });
  }

  private free(index: number, seat: Seat): void {
    this.seats.delete(index);
    void seat.link.leave();
  }
}
