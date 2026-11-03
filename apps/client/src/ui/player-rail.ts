import { BASE_SPEED, SPEED_STEP, type CharacterId, type LobbyMember } from "@bombtop/shared";
import { PLAYER_COLORS } from "./art";

export type RailSide = "left" | "right";
export type RailSpot = "top" | "middle" | "bottom";
export interface RailPlace {
  side: RailSide;
  spot: RailSpot;
}

/** A player's card on the rails beside the arena. */
export interface RailCard {
  id: string;
  name: string;
  /** "P1 · VOCÊ", "P2 · CPU", "P3". */
  tag: string;
  /** Seat color, for the card's border (the dark seat lightened to show on the dark panel). */
  accent: string;
  /** The character's paint: the seat color, or null for its original colors. */
  paint: string | null;
  character: CharacterId;
  wins: number;
  /** One per round needed to win the match: won or not. */
  pips: boolean[];
  bombs: number;
  fire: number;
  /** Speed steps, 1 = the starting speed. */
  speed: number;
  out: boolean;
  me: boolean;
  /** A rival's power-ups, kept from a player's own screen (a shared screen, with no "you", sees everyone's). */
  hidden: boolean;
}

/** What the rails read of a player in the match. */
export interface RailPlayer {
  id: string;
  alive: boolean;
  bombCapacity: number;
  fireRange: number;
  speed: number;
}

const DARK_SEAT = "#3a3a48";

export const speedLevel = (speed: number): number => 1 + Math.round((speed - BASE_SPEED) / SPEED_STEP);

/** A card per seat in the match (seat order), with the power-ups it carries now. */
export function railCards(members: readonly LobbyMember[], players: readonly RailPlayer[], me: string | null, winsToWin: number): RailCard[] {
  const inMatch = new Map(players.map((p) => [p.id, p]));
  return members.flatMap((m, seat) => {
    const p = inMatch.get(m.id);
    if (!p) return [];
    const color = PLAYER_COLORS[seat % PLAYER_COLORS.length]!;
    const isMe = m.id === me;
    const tag = `P${seat + 1}${isMe ? " · VOCÊ" : m.bot ? " · CPU" : ""}`;
    return [{
      id: m.id,
      name: m.name,
      tag,
      accent: color === DARK_SEAT ? "#8a8aa0" : color,
      paint: m.ownColors ? null : color,
      character: m.character,
      wins: m.wins,
      pips: Array.from({ length: winsToWin }, (_, k) => k < m.wins),
      bombs: p.bombCapacity,
      fire: p.fireRange,
      speed: speedLevel(p.speed),
      out: !p.alive,
      me: isMe,
      hidden: me !== null && !isMe,
    }];
  });
}

const SPOTS: RailSpot[] = ["top", "middle", "bottom"];

/**
 * Where each player's card goes: the side and corner of the arena they spawned in (tile x, y on an arena `width` x
 * `height` tiles); one spawned in the middle column goes between, on the side with fewer cards. One card a spot.
 */
export function railPlaces(spawns: readonly { id: string; x: number; y: number }[], width: number, height: number): Map<string, RailPlace> {
  const midX = (width - 1) / 2;
  const midY = (height - 1) / 2;
  const taken = new Set<string>();
  const places = new Map<string, RailPlace>();
  const free = (side: RailSide, spot: RailSpot) => !taken.has(`${side}:${spot}`);
  const count = (side: RailSide) => [...taken].filter((k) => k.startsWith(side)).length;
  for (const { id, x, y } of spawns) {
    const side: RailSide = x < midX ? "left" : x > midX ? "right" : count("left") <= count("right") ? "left" : "right";
    const spot: RailSpot = x === midX ? "middle" : y <= midY ? "top" : "bottom";
    const other: RailSide = side === "left" ? "right" : "left";
    const tries: RailPlace[] = [
      { side, spot },
      ...SPOTS.filter((s) => s !== spot && s !== "middle").map((s) => ({ side, spot: s })),
      { side: other, spot },
      ...SPOTS.map((s) => ({ side: other, spot: s })),
      { side, spot: "middle" as const },
    ];
    const place = tries.find((t) => free(t.side, t.spot));
    if (!place) continue;
    taken.add(`${place.side}:${place.spot}`);
    places.set(id, place);
  }
  return places;
}
