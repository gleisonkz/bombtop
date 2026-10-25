import { describe, expect, it } from "vitest";
import { Bot, createMatch, ItemKind, placePlayerAt, setTile, step, Tile, type BotLevel, type CharacterId, type MatchState } from "../src";
import { player, run } from "./helpers";

/** p1 (`me`) at (mx,my), p2 (`them`) at (rx,ry); no blocks. */
function duel(me: CharacterId, mx: number, my: number, rx: number, ry: number, them: CharacterId = "bomb"): MatchState {
  const s = createMatch({ seed: 1, playerIds: ["p1", "p2"], blockDensity: 0, characters: { p1: me, p2: them } });
  placePlayerAt(s, "p1", mx, my);
  placePlayerAt(s, "p2", rx, ry);
  return s;
}

const bomb = (s: MatchState, x: number, y: number, fuse = 30, range = 2, ownerId = "p2") =>
  s.bombs.push({ ownerId, x, y, fuse, range, type: "normal", slide: null, offset: 0, air: null, heldBy: null });

const think = (s: MatchState, level: BotLevel = "hard") => new Bot("p1", level, "hunter").input(s);

describe("bots use their special: line shots", () => {
  it("thor turns to a rival in line within range and fires", () => {
    const s = duel("thor", 3, 5, 7, 5);
    player(s).facing = "left";
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBe("right");
    step(s, { p1: input });
    expect(player(s, "p2").stun).toBeGreaterThan(0);
  });

  it("thor compensates reversed controls once when turning and firing", () => {
    const s = duel("thor", 3, 5, 7, 5);
    player(s).facing = "left";
    player(s).curse = { kind: "reverse" };
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBe("left");
    step(s, { p1: input });
    expect(player(s).facing).toBe("right");
    expect(player(s, "p2").stun).toBeGreaterThan(0);
  });

  it("thor holds fire when a block is in the way, the rival is out of range, or the special is recharging", () => {
    const blocked = duel("thor", 3, 5, 7, 5);
    setTile(blocked, 5, 5, Tile.Block);
    expect(think(blocked).special).toBeFalsy();
    expect(think(duel("thor", 3, 5, 9, 5)).special).toBeFalsy();
    const cooling = duel("thor", 3, 5, 7, 5);
    player(cooling).specialCooldown = 100;
    expect(think(cooling).special).toBeFalsy();
  });

  it("does not fire at a captain whose shield faces it (it would come back) nor at a rival already stunned", () => {
    const shielded = duel("thor", 3, 5, 7, 5, "captain");
    player(shielded, "p2").shield = 60;
    player(shielded, "p2").facing = "left";
    expect(think(shielded).special).toBeFalsy();
    const stunned = duel("spider", 3, 5, 7, 5);
    player(stunned, "p2").stun = 60;
    expect(think(stunned).special).toBeFalsy();
  });

  it("goku's beam goes through blocks but not walls", () => {
    const s = duel("goku", 3, 5, 6, 5);
    setTile(s, 5, 5, Tile.Block);
    expect(think(s).special).toBe(true);
    expect(think(duel("goku", 4, 3, 4, 5)).special).toBeFalsy(); // a pillar at (4,4)
  });

  it("pelé, penelope, static, spider and harry shoot along a line too", () => {
    for (const c of ["pele", "penelope", "static", "spider", "harry"] as const) {
      const s = duel(c, 3, 5, 3, 9);
      player(s).facing = "up";
      const input = think(s);
      expect(input.special, c).toBe(true);
      expect(input.dir, c).toBe("down");
    }
  });
});

describe("bots use their special: around them", () => {
  it("pikachu shocks a rival up to 2 tiles away in a clear line, not one off the lines or behind a block", () => {
    const s = duel("pikachu", 3, 5, 5, 5);
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBeNull();
    expect(think(duel("pikachu", 3, 5, 5, 7)).special).toBeFalsy();
    const blocked = duel("pikachu", 3, 5, 5, 5);
    setTile(blocked, 4, 5, Tile.Block);
    expect(think(blocked).special).toBeFalsy();
  });

  it("donatello spins with a rival next to him, not two tiles off", () => {
    expect(think(duel("donatello", 3, 5, 4, 5)).special).toBe(true);
    expect(think(duel("donatello", 3, 5, 5, 5)).special).toBeFalsy();
  });

  it("the panther tiptoes off when hunting near a rival, not with nobody around", () => {
    expect(think(duel("panther", 3, 5, 5, 5)).special).toBe(true);
    expect(think(duel("panther", 1, 1, 11, 9)).special).toBeFalsy();
  });
});

describe("bots use their special: dashes", () => {
  it("naruto dashes at a rival in reach when the way there is safe", () => {
    const s = duel("naruto", 3, 5, 6, 5);
    player(s).facing = "up";
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBe("right");
    const risky = duel("naruto", 3, 5, 6, 5);
    bomb(risky, 5, 3, 120); // its blast crosses (5,5), on the way
    expect(think(risky).special).toBeFalsy();
  });

  it("the flash dashes through a rival only when the tile he stops on is safe", () => {
    expect(think(duel("flash", 3, 5, 5, 5)).special).toBe(true);
    const risky = duel("flash", 3, 5, 5, 5);
    bomb(risky, 9, 5, 120); // stops him at (8,5), in its blast
    expect(think(risky).special).toBeFalsy();
  });

  it("optimus rolls out at a rival in line within 6 tiles", () => {
    expect(think(duel("optimus", 3, 5, 8, 5)).special).toBe(true);
    expect(think(duel("optimus", 3, 5, 11, 5)).special).toBeFalsy();
  });
});

describe("bots use their special: defence and escape", () => {
  /** p1 boxed in at (1,1) by a block below and a rival's bomb on its right, about to go off. */
  function trapped(c: CharacterId): MatchState {
    const s = duel(c, 1, 1, 11, 9);
    setTile(s, 1, 2, Tile.Block);
    bomb(s, 2, 1);
    player(s).facing = "down";
    return s;
  }

  it("the captain with no way out raises his shield toward the bomb, and lives", () => {
    const s = trapped("captain");
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBe("right");
    step(s, { p1: input });
    run(s, 80);
    expect(player(s).alive).toBe(true);
  });

  it("the captain does not bother when the bomb is under him", () => {
    const s = duel("captain", 1, 1, 11, 9);
    setTile(s, 1, 2, Tile.Block);
    setTile(s, 2, 1, Tile.Block);
    bomb(s, 1, 1);
    expect(think(s).special).toBeFalsy();
  });

  it("the green lantern with no way out sits in his bubble, and lives", () => {
    const s = trapped("lantern");
    const input = think(s);
    expect(input.special).toBe(true);
    step(s, { p1: input });
    run(s, 80);
    expect(player(s).alive).toBe(true);
  });

  it("bugs with no way out tunnels to a safe tile, and lives", () => {
    const s = trapped("bugs");
    const input = think(s);
    expect(input.special).toBe(true);
    step(s, { p1: input });
    run(s, 80);
    expect(player(s).alive).toBe(true);
  });

  it("nobody uses a defence when out of danger", () => {
    for (const c of ["captain", "lantern", "bugs"] as const) expect(think(duel(c, 1, 1, 11, 9)).special, c).toBeFalsy();
  });

  it("bugs tunnels out of a box toward a rival he cannot walk to", () => {
    const s = duel("bugs", 1, 1, 1, 7);
    setTile(s, 1, 2, Tile.Block);
    setTile(s, 2, 1, Tile.Block);
    player(s).facing = "up";
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBe("down");
  });
});

describe("bots use their special: the mega bomb", () => {
  it("the bomb mascot plants a mega bomb that catches a rival when he can get away", () => {
    const s = duel("bomb", 3, 5, 5, 5);
    expect(think(s).special).toBe(true);
  });

  it("not when he could not get away from it", () => {
    const s = duel("bomb", 1, 1, 3, 1);
    setTile(s, 1, 2, Tile.Block);
    setTile(s, 2, 1, Tile.Block);
    expect(think(s).special).toBeFalsy();
  });
});

describe("bots use their special: by level", () => {
  /** Ticks until the bot fires at a rival standing still in its line (the match frozen otherwise). */
  function reaction(level: BotLevel): number {
    const s = duel("thor", 3, 5, 7, 5);
    const bot = new Bot("p1", level, "hunter", 5);
    for (let t = 0; t < 600; t++) {
      if (bot.input(s).special) return t;
      s.tick++;
    }
    return Infinity;
  }

  it("a hard bot fires at once, a medium one a little later, an easy one later still (but it does)", () => {
    const hard = reaction("hard");
    const medium = reaction("medium");
    const easy = reaction("easy");
    expect(hard).toBe(0);
    expect(medium).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(medium);
    expect(easy).toBeLessThan(600);
  });
});

describe("bots use their special: lula's picanha", () => {
  it("lula leaves a picanha on the tile toward a rival coming down a clear line", () => {
    const s = duel("lula", 3, 5, 7, 5);
    s.items = [];
    player(s).facing = "up";
    const input = think(s);
    expect(input.special).toBe(true);
    expect(input.dir).toBe("right");
    step(s, { p1: input });
    expect(s.items).toContainEqual(expect.objectContaining({ x: 4, y: 5, kind: ItemKind.Picanha }));
  });

  it("not with the rival right next to him, past 4 tiles, or with something on the tile", () => {
    for (const [rx, fill] of [[4, false], [8, false], [7, true]] as const) {
      const s = duel("lula", 3, 5, rx, 5);
      s.items = fill ? [{ x: 4, y: 5, kind: ItemKind.Fire }] : [];
      expect(think(s).special).toBeFalsy();
    }
  });
});
