import {
  createMatch,
  DIR_VECTORS,
  ItemKind,
  MAX_FIRE_RANGE,
  MAX_SPEED,
  placePlayerAt,
  playerTile,
  setTile,
  step,
  Tile,
  tileCenter,
  TICK_RATE,
  type Facing,
  type CharacterId,
  type MatchState,
  type Player,
  type PlayerInput,
} from "@bombtop/shared";

/** The part of the arena a showcase scene plays in, in tiles. */
export const SHOWCASE_VIEW = { x: 1, y: 3, width: 11, height: 5 };

/** One thing a scripted player does: walk some tiles, press a button, face a way, or wait. */
export type Step = { go: Facing; tiles: number } | { press: "bomb" | "action" | "special" } | { face: Facing } | { wait: number } | { holdBomb: number };

interface Scene {
  /** Who plays "you" and "rival" (the mascot and the ninja when left out). */
  characters?: { you: CharacterId; rival: CharacterId };
  /** Puts players, blocks and powers in place on an empty arena. */
  setup(s: MatchState, you: Player, rival: Player): void;
  you: Step[];
  rival?: Step[];
  /** A block the scene is about breaking, if any. */
  target?: readonly [number, number];
  /** How long one loop lasts. */
  seconds: number;
}

const blocks = (s: MatchState, ...tiles: [number, number][]) => tiles.forEach(([x, y]) => setTile(s, x, y, Tile.Block));

/** Each item shown in use. Row 5 is an open corridor; odd columns are open too. */
const SCENES: Record<ItemKind, Scene> = {
  [ItemKind.Bomb]: {
    setup(s, you) {
      placePlayerAt(s, "you", 1, 5);
      you.bombCapacity = 3;
      blocks(s, [1, 4], [3, 4], [1, 6], [3, 6]);
    },
    you: [{ press: "bomb" }, { go: "right", tiles: 1 }, { press: "bomb" }, { go: "right", tiles: 1 }, { press: "bomb" }, { go: "right", tiles: 2 }, { go: "up", tiles: 1 }],
    seconds: 5,
  },
  [ItemKind.Fire]: {
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.fireRange = 5;
      blocks(s, [8, 5]);
    },
    you: [{ press: "bomb" }, { go: "left", tiles: 2 }, { go: "up", tiles: 1 }],
    target: [8, 5],
    seconds: 5,
  },
  [ItemKind.FullFire]: {
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.fireRange = MAX_FIRE_RANGE;
      blocks(s, [11, 5], [3, 7]);
    },
    you: [{ press: "bomb" }, { go: "right", tiles: 2 }, { go: "up", tiles: 1 }],
    target: [11, 5],
    seconds: 5,
  },
  [ItemKind.Speed]: {
    setup(s, you) {
      placePlayerAt(s, "you", 1, 3);
      placePlayerAt(s, "rival", 1, 7);
      you.speed = MAX_SPEED;
    },
    you: [{ go: "right", tiles: 10 }],
    rival: [{ go: "right", tiles: 10 }],
    seconds: 4,
  },
  [ItemKind.Kick]: {
    setup(s, you) {
      placePlayerAt(s, "you", 2, 5);
      you.canKick = true;
      you.fireRange = 2;
      blocks(s, [10, 5]);
    },
    you: [{ press: "bomb" }, { go: "left", tiles: 1 }, { go: "right", tiles: 1 }],
    target: [10, 5],
    seconds: 5,
  },
  [ItemKind.Remote]: {
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.bombType = "remote";
      you.fireRange = 1;
      blocks(s, [4, 5], [3, 6]);
    },
    you: [{ press: "bomb" }, { go: "left", tiles: 2 }, { go: "up", tiles: 1 }, { wait: 10 }, { press: "action" }],
    target: [4, 5],
    seconds: 3,
  },
  [ItemKind.Pierce]: {
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.bombType = "pierce";
      you.fireRange = 6;
      blocks(s, [4, 5], [5, 5], [6, 5]);
    },
    you: [{ press: "bomb" }, { go: "left", tiles: 2 }, { go: "up", tiles: 1 }],
    seconds: 5,
  },
  [ItemKind.Punch]: {
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.canPunch = true;
      you.fireRange = 1;
      blocks(s, [8, 5]);
    },
    you: [{ press: "bomb" }, { go: "left", tiles: 1 }, { face: "right" }, { press: "action" }],
    target: [8, 5],
    seconds: 5,
  },
  [ItemKind.Glove]: {
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.canGlove = true;
      you.fireRange = 1;
      you.facing = "right";
    },
    you: [{ press: "bomb" }, { wait: 6 }, { holdBomb: 30 }, { go: "left", tiles: 2 }, { go: "up", tiles: 1 }],
    seconds: 5,
  },
  [ItemKind.Skull]: {
    setup(s, you) {
      placePlayerAt(s, "you", 2, 5);
      placePlayerAt(s, "rival", 7, 5);
      you.curse = { kind: "slow" };
    },
    you: [{ go: "right", tiles: 5 }, { go: "left", tiles: 4 }],
    seconds: 5,
  },
  [ItemKind.Egg]: {
    setup(s, you) {
      placePlayerAt(s, "you", 5, 5);
      you.mount = "dasher";
      you.fireRange = 2;
    },
    you: [{ press: "bomb" }],
    seconds: 4,
  },
};

/** The player color (by seat) each character wears in their scene, as in the menus: the ninja in ice blue, Goku in green. */
const CHARACTER_COLOR: Record<CharacterId, number> = { bomb: 1, ninja: 3, captain: 0, thor: 3, goku: 4, naruto: 0, spider: 2, pikachu: 3 };

/** Each character's special shown in use, played by that character against a rival. */
const SPECIALS: Record<CharacterId, Scene> = {
  bomb: {
    characters: { you: "bomb", rival: "ninja" },
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      you.fireRange = 2;
      // Four tiles off: past his own fire, inside the mega bomb's (twice as far, piercing).
      blocks(s, [5, 5], [7, 5], [3, 7]);
    },
    you: [{ wait: 20 }, { press: "special" }, { go: "left", tiles: 2 }, { go: "up", tiles: 1 }],
    target: [7, 5],
    seconds: 5,
  },
  ninja: {
    characters: { you: "ninja", rival: "bomb" },
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      placePlayerAt(s, "rival", 6, 5);
      you.facing = "right";
    },
    you: [{ wait: 30 }, { press: "special" }],
    seconds: 4,
  },
  captain: {
    characters: { you: "captain", rival: "bomb" },
    setup(s, you, rival) {
      placePlayerAt(s, "you", 5, 5);
      placePlayerAt(s, "rival", 6, 5);
      you.facing = "right";
      rival.fireRange = 2;
    },
    // Shield up shortly before the rival's bomb, right next to him, goes off.
    you: [{ wait: 140 }, { face: "right" }, { press: "special" }],
    rival: [{ press: "bomb" }, { go: "right", tiles: 3 }, { go: "up", tiles: 1 }],
    seconds: 5,
  },
  thor: {
    characters: { you: "thor", rival: "goku" },
    setup(s, you) {
      placePlayerAt(s, "you", 3, 5);
      placePlayerAt(s, "rival", 7, 5);
      you.facing = "right";
    },
    you: [{ wait: 30 }, { press: "special" }],
    seconds: 5,
  },
  goku: {
    characters: { you: "goku", rival: "bomb" },
    setup(s, you) {
      placePlayerAt(s, "you", 2, 5);
      placePlayerAt(s, "rival", 6, 5);
      you.facing = "right";
      blocks(s, [3, 5], [4, 5], [5, 5]);
    },
    // Blasts through the blocks into the rival behind them, who is left dizzy.
    you: [{ wait: 30 }, { press: "special" }],
    seconds: 5,
  },
  naruto: {
    characters: { you: "naruto", rival: "thor" },
    setup(s, you) {
      placePlayerAt(s, "you", 2, 5);
      placePlayerAt(s, "rival", 5, 5);
      you.facing = "right";
    },
    you: [{ wait: 30 }, { press: "special" }],
    seconds: 4,
  },
  spider: {
    characters: { you: "spider", rival: "goku" },
    setup(s, you) {
      placePlayerAt(s, "you", 2, 5);
      placePlayerAt(s, "rival", 7, 5);
      you.facing = "right";
    },
    // Web him from afar, run up, leave a bomb by him and get out of its way.
    you: [{ wait: 30 }, { press: "special" }, { wait: 20 }, { go: "right", tiles: 3 }, { press: "bomb" }, { go: "left", tiles: 2 }, { go: "up", tiles: 1 }],
    seconds: 5,
  },
  pikachu: {
    characters: { you: "pikachu", rival: "naruto" },
    setup(s, you) {
      placePlayerAt(s, "you", 5, 5);
      placePlayerAt(s, "rival", 7, 5);
      you.facing = "down";
    },
    // The rival comes close, he shocks it, drops a bomb by it and runs.
    you: [{ wait: 40 }, { press: "special" }, { wait: 20 }, { go: "right", tiles: 1 }, { press: "bomb" }, { go: "left", tiles: 1 }, { go: "up", tiles: 1 }],
    seconds: 5,
  },
};

/** A character's special shown in use, looping. */
export const specialShowcase = (character: CharacterId) => new Showcase(SPECIALS[character]);

/** Plays a player's steps, one input per tick. */
export class Script {
  private i = 0;
  private waited = 0;
  private target: { x: number; y: number } | null = null;
  private stuck = 0;
  private lastPos = "";

  constructor(
    readonly id: string,
    private readonly steps: Step[],
  ) {}

  input(s: MatchState): PlayerInput {
    const p = s.players.find((q) => q.id === this.id)!;
    const st = this.steps[this.i];
    if (!st || !p.alive) return { dir: null, bomb: false };
    if ("press" in st) {
      this.i++;
      return { dir: null, bomb: st.press === "bomb", action: st.press === "action", special: st.press === "special" };
    }
    if ("face" in st) {
      this.i++;
      return { dir: st.face, bomb: false };
    }
    if ("holdBomb" in st) {
      // Pressed on the first tick, then kept down; letting go (the next step) throws a carried bomb.
      const first = this.waited === 0;
      if (++this.waited >= st.holdBomb) {
        this.waited = 0;
        this.i++;
      }
      return { dir: null, bomb: first, hold: true };
    }
    if ("wait" in st) {
      if (++this.waited >= st.wait) {
        this.waited = 0;
        this.i++;
      }
      return { dir: null, bomb: false };
    }
    if (!this.target) {
      const here = playerTile(p);
      const [dx, dy] = DIR_VECTORS[st.go];
      this.target = { x: here.x + dx * st.tiles, y: here.y + dy * st.tiles };
    }
    const there = p.px === tileCenter(this.target.x) && p.py === tileCenter(this.target.y);
    const pos = `${p.px},${p.py}`;
    this.stuck = pos === this.lastPos ? this.stuck + 1 : 0;
    this.lastPos = pos;
    if (there || this.stuck > 20) {
      this.target = null;
      this.stuck = 0;
      this.i++;
      return this.input(s);
    }
    return { dir: st.go, bomb: false };
  }
}

/** An item (or a scene of its own) shown in use on a small stretch of arena, looping. */
export class Showcase {
  state!: MatchState;
  readonly length: number;
  readonly target: readonly [number, number] | undefined;
  /** Player colors (seat numbers) the scene's characters wear instead of their seat's; empty for the items. */
  readonly colors: Map<string, number>;
  private readonly scene: Scene;
  private scripts: Script[] = [];
  private tick = 0;

  constructor(what: ItemKind | Scene) {
    const scene = (this.scene = typeof what === "object" ? what : SCENES[what]);
    this.length = scene.seconds * TICK_RATE;
    this.target = scene.target;
    const cast = scene.characters;
    this.colors = new Map(cast ? [["you", CHARACTER_COLOR[cast.you]], ["rival", CHARACTER_COLOR[cast.rival]]] : []);
    this.reset();
  }

  /** One simulation tick; starts over once the scene has played. */
  advance(): void {
    if (this.tick >= this.length) this.reset();
    this.tick++;
    const inputs: Record<string, PlayerInput> = {};
    for (const sc of this.scripts) inputs[sc.id] = sc.input(this.state);
    step(this.state, inputs);
  }

  private reset(): void {
    const scene = this.scene;
    const s = createMatch({ seed: 1, playerIds: ["you", "rival"], blockDensity: 0, revenge: false, characters: scene.characters ?? { you: "bomb", rival: "ninja" } });
    s.items = [];
    const [you, rival] = s.players as [Player, Player];
    // The rival waits out of the way unless the scene needs it.
    placePlayerAt(s, "rival", 11, 7);
    scene.setup(s, you, rival);
    this.state = s;
    this.tick = 0;
    this.scripts = [new Script("you", scene.you), ...(scene.rival ? [new Script("rival", scene.rival)] : [])];
  }
}
