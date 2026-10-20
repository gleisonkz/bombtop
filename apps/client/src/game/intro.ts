import { createMatch, placePlayerAt, step, TICK_RATE, type MatchState, type PlayerInput } from "@bombtop/shared";
import { Script } from "./showcase";

/** The stretch of arena the intro plays in (tiles), zoomed to fill the screen. */
export const INTRO_VIEW = { x: 1, y: 2, width: 11, height: 7 };

/** How long the intro lasts. */
export const INTRO_TICKS = 7 * TICK_RATE;

export interface IntroCard {
  name: string;
  line: string;
}

/** Who is introduced when (ticks), then the logo until the end. */
const CARDS: { from: number; to: number; card: IntroCard }[] = [
  { from: 10, to: 120, card: { name: "Bomba", line: "O mascote explosivo. Planta a bomba e sai correndo!" } },
  { from: 120, to: 200, card: { name: "Ninja", line: "Raio de gelo! Quem estiver na frente vira picolé." } },
  { from: 200, to: 330, card: { name: "Capitão América", line: "Ergue o escudo e devolve o fogo pra quem mandou!" } },
];
const LOGO_FROM = 330;

/**
 * The title intro: the characters walk on one by one and show their moves in a real match
 * (row 5 is an open corridor). The mascot drops a bomb and walks off, the ninja's ice hits it,
 * the captain raises his shield and the blast bounces back off it, then the logo.
 */
export class Intro {
  readonly state: MatchState;
  private readonly scripts: Script[];

  constructor() {
    const s = createMatch({
      seed: 1,
      // Seat order picks the arena colors: white captain (keeps his navy suit), black bomb, red ninja.
      playerIds: ["captain", "bomb", "ninja"],
      blockDensity: 0,
      revenge: false,
      characters: { bomb: "bomb", ninja: "ninja", captain: "captain" },
    });
    s.items = [];
    placePlayerAt(s, "bomb", 7, 5);
    placePlayerAt(s, "ninja", 2, 5);
    placePlayerAt(s, "captain", 11, 5);
    const [captain, bomb, ninja] = s.players;
    bomb!.facing = "down";
    bomb!.fireRange = 1;
    ninja!.facing = "right";
    captain!.facing = "left";
    this.state = s;
    this.scripts = [
      // Drops its bomb on (7,5) and climbs out of its reach.
      new Script("bomb", [{ wait: 100 }, { press: "bomb" }, { go: "up", tiles: 2 }]),
      // Ice straight at the bomb, which stops it.
      new Script("ninja", [{ wait: 160 }, { press: "special" }]),
      // Next to the bomb, shield up before it blows: its fire bounces back down the corridor.
      new Script("captain", [{ wait: 200 }, { go: "left", tiles: 3 }, { wait: 6 }, { press: "special" }]),
    ];
  }

  get done(): boolean {
    return this.state.tick >= INTRO_TICKS;
  }

  /** One simulation tick (nothing once it is over). */
  advance(): void {
    if (this.done) return;
    const inputs: Record<string, PlayerInput> = {};
    for (const sc of this.scripts) inputs[sc.id] = sc.input(this.state);
    step(this.state, inputs);
  }

  /** The character being introduced right now, if any. */
  card(): IntroCard | null {
    const t = this.state.tick;
    return CARDS.find((c) => t >= c.from && t < c.to)?.card ?? null;
  }

  /** Whether the logo shows (the last beat). */
  logo(): boolean {
    return this.state.tick >= LOGO_FROM;
  }
}

const SEEN_KEY = "bombtop.intro";

/** True the first time in a browser session (and marks it seen). */
export function introDue(store: { get(key: string): string | null; set(key: string, value: string): void }): boolean {
  if (store.get(SEEN_KEY)) return false;
  store.set(SEEN_KEY, "1");
  return true;
}
