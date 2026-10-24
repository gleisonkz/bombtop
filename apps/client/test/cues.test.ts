import { describe, expect, it } from "vitest";
import { blastLife, BLAST_TICKS, BUBBLE_TICKS, createMatch, FUSE_TICKS, ItemKind, publicView, Tile, TILE, type Bomb, type PublicView } from "@bombtop/shared";
import { Listener, soundCues } from "../src/audio/cues";

function view(): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["a", "b"], blockDensity: 0 }));
}

/** The same view two ticks later, edited by `change`. */
function later(prev: PublicView, change: (v: PublicView) => void): PublicView {
  const next = structuredClone(prev);
  next.tick += 2;
  change(next);
  return next;
}

const bomb = (x: number, y: number, extra: Partial<Bomb> = {}): Bomb => ({
  ownerId: "a", x, y, fuse: FUSE_TICKS, range: 1, type: "normal", slide: null, offset: 0, air: null, heldBy: null, ...extra,
});

const names = (prev: PublicView, next: PublicView) => soundCues(prev, next).map((c) => c.name);

describe("soundCues", () => {
  it("is silent when nothing happened", () => {
    const v = view();
    expect(soundCues(v, later(v, () => {}))).toEqual([]);
  });

  it("hears a bomb being placed, at its column", () => {
    const v = view();
    const next = later(v, (n) => n.bombs.push(bomb(3, 1, { fuse: FUSE_TICKS - 2 })));
    expect(soundCues(v, next)).toEqual([{ name: "place", x: 3.5 }]);
  });

  it("does not re-hear a waiting remote bomb", () => {
    const v = view();
    v.bombs.push(bomb(3, 1, { type: "remote" }));
    expect(names(v, later(v, () => {}))).toEqual([]);
  });

  it("hears one explosion per frame, louder with more flames", () => {
    const v = view();
    v.bombs.push(bomb(3, 1, { fuse: 1 }));
    const next = later(v, (n) => {
      n.bombs = [];
      n.flames = [{ x: 3, y: 1, ttl: 30 }, { x: 4, y: 1, ttl: 30 }, { x: 5, y: 1, ttl: 30 }];
    });
    expect(soundCues(v, next)).toEqual([{ name: "explode", x: 4.5, size: 3 }]);
  });

  it("hears blocks breaking and sudden-death walls landing", () => {
    const v = view();
    const i = (x: number, y: number) => y * v.grid.width + x;
    v.grid.tiles[i(3, 1)] = Tile.Block;
    const next = later(v, (n) => {
      n.grid.tiles[i(3, 1)] = Tile.Empty;
      n.grid.tiles[i(5, 1)] = Tile.Wall;
    });
    expect(names(v, next)).toEqual(["break", "wall"]);
  });

  it("hears a block break when it starts burning (a Kamehameha's block makes no explosion sound), not when it has burned away", () => {
    const v = view();
    const i = (x: number, y: number) => y * v.grid.width + x;
    v.grid.tiles[i(3, 1)] = Tile.Block;
    const lit = later(v, (n) => n.flames.push({ x: 3, y: 1, ttl: 30, block: true }));
    expect(names(v, lit)).toEqual(["break"]);
    const gone = later(lit, (n) => {
      n.flames = [];
      n.grid.tiles[i(3, 1)] = Tile.Empty;
    });
    expect(names(lit, gone)).toEqual([]);
  });

  it("hears kicks and punches by bombs starting to move", () => {
    const v = view();
    v.bombs.push(bomb(3, 1), bomb(5, 1));
    const next = later(v, (n) => {
      n.bombs[0]!.slide = "right";
      n.bombs[1]!.air = { dir: "down", span: 3, tilesLeft: 3, progress: 0 };
    });
    expect(names(v, next)).toEqual(["kick", "throw"]);
  });

  it("hears items picked up, but not items burned", () => {
    const v = view();
    v.items.push({ x: 3, y: 1, kind: ItemKind.Fire }, { x: 5, y: 1, kind: ItemKind.Bomb });
    const next = later(v, (n) => {
      n.items = [];
      n.flames = [{ x: 5, y: 1, ttl: 30 }];
    });
    expect(names(v, next)).toEqual(["explode", "pickup"]);
  });

  it("leaves skulls to the curse cue", () => {
    const v = view();
    v.items.push({ x: 1, y: 2, kind: ItemKind.Skull });
    const next = later(v, (n) => {
      n.items = [];
      n.players[0]!.curse = { kind: "slow" };
    });
    expect(names(v, next)).toEqual(["curse"]);
  });

  it("hears what happens to players", () => {
    const v = view();
    v.players[1]!.mount = "hopper";
    const next = later(v, (n) => {
      const [a, b] = n.players;
      a!.alive = false;
      b!.mount = null;
      b!.stun = 60;
    });
    expect(soundCues(v, next)).toEqual([
      { name: "bomb-death", x: v.players[0]!.px / TILE },
      { name: "stun", x: v.players[1]!.px / TILE },
      { name: "dismount", x: v.players[1]!.px / TILE },
    ]);
  });

  it("hears a mega bomb land with its own thud", () => {
    const v = view();
    const next = later(v, (n) => void n.bombs.push(bomb(3, 5, { type: "pierce", range: 4, mega: true })));
    expect(names(v, next)).toEqual(["mega"]);
  });

  it("hears a character with a voice cry out in their own voice", () => {
    const v = view();
    v.players[0]!.character = "goku";
    const next = later(v, (n) => void (n.players[0]!.alive = false));
    expect(names(v, next)).toEqual(["goku-death"]);
  });

  it("hears a character shout as they use their special", () => {
    const v = view();
    v.players[0]!.character = "thor";
    v.players[1]!.character = "goku";
    v.players[1]!.specialCooldown = 100;
    const next = later(v, (n) => {
      n.players[0]!.specialCooldown = 1200;
      n.players[1]!.specialCooldown = 98; // still recharging: nothing new
    });
    expect(names(v, next)).toEqual(["thor-special"]);
  });

  it("hears mounting, jumps, dashes and warps", () => {
    const v = view();
    v.players[1]!.mount = "dasher";
    const next = later(v, (n) => {
      const [a, b] = n.players;
      a!.mount = "hopper";
      a!.jumpTicks = 16;
      a!.warpLock = true;
      b!.dashTicks = 16;
    });
    expect(names(v, next)).toEqual(["mount", "jump", "warp", "dash"]);
  });

  it("hears the kamehameha when goku starts charging it, and not again when the beam leaves", () => {
    const v = view();
    const charging = later(v, (n) => void (n.players[0]!.charge = 18));
    expect(names(v, charging)).toEqual(["kamehameha"]);
    const fired = later(charging, (n) => {
      n.players[0]!.charge = 0;
      n.blasts.push({ ownerId: n.players[0]!.id, x: 1, y: 1, dir: "right", length: 3, ttl: BLAST_TICKS - 1, kind: "kamehameha" });
    });
    expect(names(charging, fired)).toEqual([]);
  });

  it("hears the rasengan when naruto starts his dash, and not again when it strikes", () => {
    const v = view();
    const dashing = later(v, (n) => void (n.players[0]!.rasengan = 11));
    expect(names(v, dashing)).toEqual(["rasengan"]);
    const struck = later(dashing, (n) => {
      n.players[0]!.rasengan = 0;
      n.blasts.push({ ownerId: n.players[0]!.id, x: 1, y: 1, dir: "right", length: 1, ttl: BLAST_TICKS - 1, kind: "rasengan" });
    });
    expect(names(dashing, struck)).toEqual([]);
  });

  it("hears thunder for a lightning bolt, at the caster", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 4, y: 1, dir: "left", length: 2, ttl: BLAST_TICKS - 1, kind: "lightning" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "thunder", x: 4.5 }]);
  });

  it("hears one shock for Pikachu's thunder shock, not one per arm", () => {
    const v = view();
    const next = later(v, (n) => {
      for (const dir of ["up", "down", "left", "right"] as const) n.blasts.push({ ownerId: "a", x: 4, y: 1, dir, length: 1, ttl: BLAST_TICKS - 1, kind: "thunder" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "shock", x: 4.5 }]);
  });

  it("hears Static's magnet pull, at the caster", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 4, y: 1, dir: "left", length: 2, ttl: BLAST_TICKS - 1, kind: "magnet" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "magnet", x: 4.5 }]);
  });

  it("hears the flash's dash, where he left from", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 1, y: 1, dir: "right", length: 4, ttl: BLAST_TICKS - 1, kind: "flash" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "zoom", x: 1.5 }]);
  });

  it("hears bugs digging in, where he went under", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 1, y: 1, dir: "right", length: 4, ttl: BLAST_TICKS - 1, kind: "tunnel" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "dig", x: 1.5 }]);
  });

  it("hears donatello's staff spin, where he spun it", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 1, y: 1, dir: "down", length: 1, ttl: BLAST_TICKS - 1, kind: "spin" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "spin", x: 1.5 }]);
  });

  it("hears penelope's blown kiss, where she blew it", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 1, y: 1, dir: "right", length: 3, ttl: BLAST_TICKS - 1, kind: "kiss" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "kiss", x: 1.5 }]);
  });

  it("hears harry's stag galloping off, where he cast it", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 1, y: 1, dir: "right", length: 9, ttl: blastLife({ kind: "patronus", length: 9 }) - 1, kind: "patronus" });
    });
    expect(soundCues(v, next)).toEqual([{ name: "gallop", x: 1.5 }]);
  });

  it("hears optimus transform, his truck's engine roar as it pulls away, and him transform back where it stopped", async () => {
    const { TRUCK_SHIFT, TRUCK_TICKS } = await import("@bombtop/shared");
    const v = view();
    const shift = later(v, (n) => {
      n.players[0]!.truck = TRUCK_SHIFT + TRUCK_TICKS;
    });
    expect(names(v, shift)).toContain("transform");
    const drive = later(shift, (n) => {
      n.players[0]!.truck = TRUCK_TICKS - 1;
    });
    expect(names(shift, drive)).toEqual(["truck"]);
    const back = later(drive, (n) => {
      n.players[0]!.truck = 0;
      n.blasts.push({ ownerId: "a", x: 4, y: 1, dir: "right", length: 0, ttl: BLAST_TICKS - 1, kind: "truck" });
    });
    expect(soundCues(drive, back)).toEqual([{ name: "transform", x: 4.5 }]);
  });

  it("hears the green lantern's bubble rising round him and giving way", () => {
    const v = view();
    const up = later(v, (n) => {
      n.players[0]!.bubble = BUBBLE_TICKS;
    });
    expect(names(v, up)).toContain("bubble");
    const held = later(up, (n) => {
      n.players[0]!.bubble -= 2;
    });
    expect(names(up, held)).toEqual([]);
    const near = later(v, (n) => {
      n.players[0]!.bubble = 1;
    });
    const gone = later(near, (n) => {
      n.players[0]!.bubble = 0;
    });
    expect(names(near, gone)).toEqual(["pop"]);
  });

  it("hears an ice blast cast, at the caster, and the player it freezes", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 2, y: 1, dir: "right", length: 3, ttl: BLAST_TICKS - 2, kind: "ice" });
      n.players[1]!.frozen = 300;
    });
    expect(soundCues(v, next)).toEqual([
      { name: "ice", x: 2.5 },
      { name: "freeze", x: next.players[1]!.px / TILE },
    ]);
    const after = later(next, (n) => {
      n.blasts[0]!.ttl -= 2;
      n.players[1]!.frozen -= 2;
    });
    expect(names(next, after)).toEqual([]);
  });

  it("hears a web shot, at the caster, and the player it wraps up", () => {
    const v = view();
    const next = later(v, (n) => {
      n.blasts.push({ ownerId: "a", x: 2, y: 1, dir: "right", length: 3, ttl: BLAST_TICKS - 2, kind: "web" });
      n.players[1]!.webbed = 240;
    });
    expect(soundCues(v, next)).toEqual([
      { name: "web", x: 2.5 },
      { name: "webbed", x: next.players[1]!.px / TILE },
    ]);
    const after = later(next, (n) => {
      n.blasts[0]!.ttl -= 2;
      n.players[1]!.webbed -= 2;
    });
    expect(names(next, after)).toEqual([]);
  });

  it("hears sudden death starting", () => {
    const v = view();
    expect(names(v, later(v, (n) => (n.pressure = 1)))).toEqual(["hurry"]);
  });
});

describe("Listener", () => {
  it("hears each change once, as the drawn view moves forward", () => {
    const l = new Listener();
    const v = view();
    const next = later(v, (n) => n.bombs.push(bomb(3, 1)));
    expect(l.hear(v)).toEqual([]);
    expect(l.hear(next).map((c) => c.name)).toEqual(["place"]);
    expect(l.hear(next)).toEqual([]);
  });

  it("starts over, silently, when a new match begins", () => {
    const l = new Listener();
    const v = view();
    v.tick = 500;
    l.hear(v);
    const fresh = view();
    fresh.bombs.push(bomb(3, 1));
    expect(l.hear(fresh)).toEqual([]);
  });
});
