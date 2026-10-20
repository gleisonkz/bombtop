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
  type MatchState,
  type Player,
  type PlayerInput,
} from "@bombtop/shared";

/** The part of the arena a showcase scene plays in, in tiles. */
export const SHOWCASE_VIEW = { x: 1, y: 3, width: 11, height: 5 };

/** One thing a scripted player does: walk some tiles, press a button, face a way, or wait. */
type Step = { go: Facing; tiles: number } | { press: "bomb" | "action" } | { face: Facing } | { wait: number } | { holdBomb: number };

interface Scene {
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
      you.curse = { kind: "slow", ticks: 10 * TICK_RATE };
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

/** Plays a player's steps, one input per tick. */
class Script {
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
      return { dir: null, bomb: st.press === "bomb", action: st.press === "action" };
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

/** An item shown in use on a small stretch of arena, looping. */
export class Showcase {
  state!: MatchState;
  readonly length: number;
  readonly target: readonly [number, number] | undefined;
  private scripts: Script[] = [];
  private tick = 0;

  constructor(readonly kind: ItemKind) {
    const scene = SCENES[kind];
    this.length = scene.seconds * TICK_RATE;
    this.target = scene.target;
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
    const scene = SCENES[this.kind];
    const s = createMatch({ seed: 1, playerIds: ["you", "rival"], blockDensity: 0, revenge: false, characters: { you: "bomb", rival: "ninja" } });
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
