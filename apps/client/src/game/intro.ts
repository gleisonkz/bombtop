import { createMatch, placePlayerAt, setTile, step, Tile, TICK_RATE, type MatchState, type PlayerInput } from "@bombtop/shared";
import { Script } from "./showcase";

/** The stretch of arena the intro plays in (tiles), zoomed to fill the screen. */
export const INTRO_VIEW = { x: 1, y: 2, width: 11, height: 7 };

/** How long the intro lasts. */
export const INTRO_TICKS = 39 * TICK_RATE;

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
  { from: 690, to: 810, card: { name: "Homem-Aranha", line: "Teia! Quem leva fica enrolado num casulo, sem fugir da bomba." } },
  { from: 810, to: 930, card: { name: "Pikachu", line: "Choque do Trovão! Uma descarga em volta deixa tonto quem estiver perto." } },
  { from: 930, to: 1050, card: { name: "Super Choque", line: "Puxão magnético! Arrasta o rival lá de longe pra colado nele, tonto." } },
  { from: 1050, to: 1170, card: { name: "Flash", line: "Supervelocidade! Atravessa a fileira num piscar e deixa todo mundo tonto." } },
  { from: 1170, to: 1290, card: { name: "Pernalonga", line: "Toca! Cava por baixo de paredes, blocos e bombas e sai lá na frente." } },
  { from: 1290, to: 1410, card: { name: "Lanterna Verde", line: "Bolha de energia! Fica dentro dela e o fogo não chega nele." } },
  { from: 1410, to: 1530, card: { name: "Donatello", line: "Giro do bastão! Deixa tonto quem está colado e rebate as bombas pra longe." } },
  { from: 1530, to: 1650, card: { name: "Penélope Charmosa", line: "Beijo charmoso! Manda um beijinho e quem leva fica encantado, parado." } },
  { from: 1650, to: 1880, card: { name: "Pantera Cor-de-Rosa", line: "Na ponta dos pés! Some da vista dos rivais e planta a bomba sem ninguém ver." } },
  { from: 1880, to: 2040, card: { name: "Harry Potter", line: "Expecto Patronum! O cervo prateado galopa e deixa tonto todo mundo no caminho." } },
  { from: 2040, to: 2210, card: { name: "Optimus Prime", line: "Autobots, rolar! Vira caminhão e leva no para-choque quem estiver na frente." } },
];
const LOGO_FROM = 2210;

/**
 * The title intro: the characters walk on one by one and show their moves in a real match
 * (row 5 is an open corridor). The mascot plants its mega bomb and walks off, the ninja's ice hits it,
 * the captain raises his shield and the blast bounces back off it, Thor's bolt leaves the mascot dizzy
 * up in row 3, Goku's Kamehameha smashes a row of blocks in row 7, Naruto's Rasengan knocks the mascot
 * back along row 3, the spider walks down row 7 (open since the Kamehameha) and webs Goku, Pikachu steps up
 * from row 8 and shocks the spider, Static steps up into row 7 and drags Pikachu over to him with his magnet, the flash steps up into row 3 and zips through Naruto, the
 * mascot and Thor, bugs digs along row 4 under two pillars and pops out past them, the green lantern
 * sits out his own bomb's fire in his bubble in row 6, donatello plants a bomb, steps up by the ninja and spins his
 * staff (the ninja left dizzy, the bomb batted down the column), penelope steps into row 5 and blows the captain a kiss
 * (he is left charmed), the pink panther tiptoes out of sight into row 7, leaves a bomb between goku and the spider
 * and slips back out (the intro shows him faint), harry steps down into row 3 and casts his patronus: the stag leaves
 * naruto and the flash dizzy at once, optimus steps up into row 5 and rolls out: his truck shoves the captain down the
 * corridor until he is pinned against penelope, dizzy, then the logo.
 * Every playable character has its moment here (a test checks it): a new one gets a card and a move.
 */
export class Intro {
  readonly state: MatchState;
  /** Seats some wear instead of their own (renderer `setColors`): the spider's seventh would be the second's black. */
  readonly colors = new Map([["spider", 2], ["pikachu", 3], ["static", 3], ["flash", 2], ["bugs", 3], ["lantern", 4], ["donatello", 3], ["panther", 3], ["harry", 2], ["optimus", 3]]);
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
    // And the spider in a seventh, dressed in red (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "spider", character: "spider" });
    // And Pikachu in an eighth, in blue to keep his blue scarf (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "pikachu", character: "pikachu" });
    // And Static in a ninth, in blue to keep his blue coat (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "static", character: "static" });
    // And the flash in a tenth, in red (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "flash", character: "flash" });
    // And bugs in an eleventh, in blue to keep his blue scarf (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "bugs", character: "bugs" });
    // And the green lantern in a twelfth, in green (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "lantern", character: "lantern" });
    // And donatello in a thirteenth (his purple bandana is his own: see `ownColors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "donatello", character: "donatello" });
    // And penelope in a fourteenth (her pink suit is her own: see `ownColors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "penelope", character: "penelope" });
    // And the pink panther in a fifteenth, in blue to keep his blue scarf (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "panther", character: "panther" });
    // And harry in a sixteenth, in red to keep his robe's red lining (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "harry", character: "harry" });
    // And optimus in a seventeenth, in blue to keep his blue armor (see `colors`).
    s.players.push({ ...structuredClone(s.players[0]!), id: "optimus", character: "optimus" });
    s.items = [];
    placePlayerAt(s, "bomb", 7, 5);
    placePlayerAt(s, "ninja", 2, 5);
    placePlayerAt(s, "captain", 11, 5);
    placePlayerAt(s, "thor", 11, 3);
    placePlayerAt(s, "goku", 1, 7);
    placePlayerAt(s, "naruto", 2, 3);
    placePlayerAt(s, "spider", 11, 7);
    placePlayerAt(s, "pikachu", 9, 8);
    placePlayerAt(s, "static", 11, 8);
    placePlayerAt(s, "flash", 5, 4);
    placePlayerAt(s, "bugs", 1, 4);
    placePlayerAt(s, "lantern", 9, 6);
    placePlayerAt(s, "donatello", 1, 6);
    placePlayerAt(s, "penelope", 11, 6);
    placePlayerAt(s, "panther", 5, 8);
    placePlayerAt(s, "harry", 3, 2);
    placePlayerAt(s, "optimus", 3, 6);
    for (let x = 3; x <= 7; x++) setTile(s, x, 7, Tile.Block); // for the Kamehameha to smash
    const [captain, bomb, ninja, thor, goku, naruto, spider, pikachu, zap, flash, bugs, lantern, donatello, penelope, panther, harry, optimus] = s.players;
    bomb!.facing = "down";
    bomb!.fireRange = 1;
    ninja!.facing = "right";
    captain!.facing = "left";
    thor!.facing = "left";
    goku!.facing = "right";
    naruto!.facing = "right";
    spider!.facing = "left";
    pikachu!.facing = "up";
    zap!.facing = "up";
    flash!.facing = "up";
    bugs!.facing = "down";
    lantern!.facing = "down";
    lantern!.fireRange = 1;
    donatello!.facing = "up";
    donatello!.fireRange = 1;
    penelope!.facing = "up";
    panther!.facing = "up";
    panther!.fireRange = 1;
    harry!.facing = "down";
    optimus!.facing = "up";
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
      // Walks in along row 7 until Goku is in reach and webs him.
      new Script("spider", [{ wait: 690 }, { go: "left", tiles: 4 }, { wait: 6 }, { press: "special" }]),
      // Steps up into row 7, two tiles from the spider, turns to him and shocks him.
      new Script("pikachu", [{ wait: 810 }, { go: "up", tiles: 1 }, { face: "left" }, { wait: 6 }, { press: "special" }]),
      // Comes up into row 7 on the right, turns to Pikachu two tiles off and drags him over.
      new Script("static", [{ wait: 930 }, { go: "up", tiles: 1 }, { face: "left" }, { wait: 6 }, { press: "special" }]),
      // Steps up into row 3 and zips right through Naruto, the mascot and Thor.
      new Script("flash", [{ wait: 1050 }, { go: "up", tiles: 1 }, { face: "right" }, { wait: 6 }, { press: "special" }]),
      // Turns to the pillars in row 4 and digs under them, coming out where the flash stood.
      new Script("bugs", [{ wait: 1170 }, { face: "right" }, { wait: 10 }, { press: "special" }]),
      // Plants a bomb at his feet and, just before it blows, raises his bubble and sits out its fire.
      new Script("lantern", [{ wait: 1180 }, { press: "bomb" }, { wait: 140 }, { press: "special" }]),
      // Plants a bomb, steps up next to the ninja and spins: the ninja is left dizzy, the bomb batted down the column
      // (it lands out of the frame and is dropped there).
      new Script("donatello", [{ wait: 1440 }, { press: "bomb" }, { go: "up", tiles: 1 }, { wait: 10 }, { press: "special" }]),
      // Steps up into row 5, turns to the captain down the corridor and blows him a kiss: he is left charmed.
      new Script("penelope", [{ wait: 1540 }, { go: "up", tiles: 1 }, { face: "left" }, { wait: 6 }, { press: "special" }]),
      // Tiptoes out of sight, up into row 7 between goku and the spider, leaves a bomb there and slips back down.
      // Steps down into row 3, turns along it and casts his patronus: the stag runs through naruto and the flash.
      new Script("harry", [{ wait: 1890 }, { go: "down", tiles: 1 }, { face: "right" }, { wait: 6 }, { press: "special" }]),
      // Steps up into row 5 and rolls out: the truck shoves the captain along until he is pinned against penelope.
      new Script("optimus", [{ wait: 2050 }, { go: "up", tiles: 1 }, { face: "right" }, { wait: 6 }, { press: "special" }]),
      new Script("panther", [{ wait: 1650 }, { press: "special" }, { go: "up", tiles: 1 }, { go: "left", tiles: 1 }, { press: "bomb" }, { go: "right", tiles: 1 }, { go: "down", tiles: 1 }]),
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
    // A bomb that lands out of the frame (donatello bats his own down off it) is gone: its blast would not be seen.
    const v = INTRO_VIEW;
    this.state.bombs = this.state.bombs.filter((b) => b.air || (b.x >= v.x && b.x < v.x + v.width && b.y >= v.y && b.y < v.y + v.height));
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
