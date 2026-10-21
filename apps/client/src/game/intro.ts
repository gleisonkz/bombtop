import { createMatch, placePlayerAt, setTile, step, Tile, TICK_RATE, type MatchState, type PlayerInput } from "@bombtop/shared";
import { Script } from "./showcase";

/** The stretch of arena the intro plays in (tiles), zoomed to fill the screen. */
export const INTRO_VIEW = { x: 1, y: 2, width: 11, height: 7 };

/** How long the intro lasts. */
export const INTRO_TICKS = 13 * TICK_RATE;

export interface IntroCard {
  name: string;
  line: string;
}

/** Who is introduced when (ticks), then the logo until the end. */
const CARDS: { from: number; to: number; card: IntroCard }[] = [
  { from: 10, to: 120, card: { name: "Bomba", line: "Bomba gigante! Planta uma bombona que atravessa tudo e sai correndo." } },
  { from: 120, to: 200, card: { name: "Ninja", line: "Raio de gelo! Quem estiver na frente vira picolé." } },
  { from: 200, to: 330, card: { name: "Capitão América", line: "Ergue o escudo e devolve o fogo pra quem mandou!" } },
  { from: 330, to: 450, card: { name: "Thor", line: "Ergue o martelo e solta um raio: quem leva fica tonto!" } },
  { from: 450, to: 570, card: { name: "Goku", line: "Kamehameha! Carrega o ki e manda um raio que derruba tudo na frente." } },
  { from: 570, to: 690, card: { name: "Naruto", line: "Rasengan! Avança com a esfera de chakra e arremessa quem estiver na frente." } },
];
const LOGO_FROM = 690;

/**
 * The title intro: the characters walk on one by one and show their moves in a real match
 * (row 5 is an open corridor). The mascot plants its mega bomb and walks off, the ninja's ice hits it,
 * the captain raises his shield and the blast bounces back off it, Thor's bolt leaves the mascot dizzy
 * up in row 3, Goku's Kamehameha smashes a row of blocks in row 7, Naruto's Rasengan knocks the mascot
 * back along row 3, then the logo.
 * Every playable character has its moment here (a test checks it): a new one gets a card and a move.
 */
export class Intro {
  readonly state: MatchState;
  private readonly scripts: Script[];

  constructor() {
    const s = createMatch({
      seed: 1,
      // Seat order picks the arena colors: white captain (keeps his navy suit), black bomb, red ninja, blue thor, green goku.
      playerIds: ["captain", "bomb", "ninja", "thor", "goku"],
      blockDensity: 0,
      revenge: false,
      characters: { bomb: "bomb", ninja: "ninja", captain: "captain", thor: "thor", goku: "goku" },
    });
    // One more than a match seats: Naruto sits in the sixth seat, which takes the first one's colors.
    s.players.push({ ...structuredClone(s.players[0]!), id: "naruto", character: "naruto" });
    s.items = [];
    placePlayerAt(s, "bomb", 7, 5);
    placePlayerAt(s, "ninja", 2, 5);
    placePlayerAt(s, "captain", 11, 5);
    placePlayerAt(s, "thor", 11, 3);
    placePlayerAt(s, "goku", 1, 7);
    placePlayerAt(s, "naruto", 2, 3);
    for (let x = 3; x <= 7; x++) setTile(s, x, 7, Tile.Block); // for the Kamehameha to smash
    const [captain, bomb, ninja, thor, goku, naruto] = s.players;
    bomb!.facing = "down";
    bomb!.fireRange = 1;
    ninja!.facing = "right";
    captain!.facing = "left";
    thor!.facing = "left";
    goku!.facing = "right";
    naruto!.facing = "right";
    this.state = s;
    this.scripts = [
      // Plants its mega bomb on (7,5), climbs out of its reach and back down to row 3 once it has blown.
      new Script("bomb", [{ wait: 100 }, { press: "special" }, { go: "up", tiles: 3 }, { wait: 170 }, { go: "down", tiles: 1 }]),
      // Ice straight at the bomb, which stops it.
      new Script("ninja", [{ wait: 160 }, { press: "special" }]),
      // Next to the bomb, shield up before it blows: its fire bounces back down the corridor.
      new Script("captain", [{ wait: 200 }, { go: "left", tiles: 3 }, { wait: 6 }, { press: "special" }]),
      // Steps in along row 3 and strikes the mascot, who climbed up there out of its bomb's reach.
      new Script("thor", [{ wait: 330 }, { go: "left", tiles: 1 }, { wait: 6 }, { press: "special" }]),
      // Steps up to the wall of blocks in row 7 and blasts through all five.
      new Script("goku", [{ wait: 450 }, { go: "right", tiles: 1 }, { wait: 6 }, { press: "special" }]),
      // Steps in along row 3 and dashes into the dizzy mascot, knocking it back toward Thor.
      new Script("naruto", [{ wait: 570 }, { go: "right", tiles: 2 }, { wait: 6 }, { press: "special" }]),
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
