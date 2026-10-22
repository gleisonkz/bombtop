import { describe, expect, it } from "vitest";
import { CHARACTERS, playerTile, Tile } from "@bombtop/shared";
import { Intro, INTRO_TICKS, INTRO_VIEW, introDue } from "../src/game/intro";

/** Runs the intro, calling `each` after every tick. */
function play(each: (intro: Intro) => void = () => {}): Intro {
  const intro = new Intro();
  while (!intro.done) {
    intro.advance();
    each(intro);
  }
  return intro;
}

describe("Intro", () => {
  it("introduces the characters one by one, then shows the logo", () => {
    const seen: string[] = [];
    play((intro) => {
      const card = intro.card();
      const key = card?.name ?? (intro.logo() ? "logo" : null);
      if (key && seen[seen.length - 1] !== key) seen.push(key);
    });
    expect(seen).toEqual(["Bomba", "Ninja", "Capitão América", "Thor", "Goku", "Naruto", "Homem-Aranha", "Pikachu", "Super Choque", "Flash", "logo"]);
  });

  it("each card says what the character does", () => {
    const lines = new Set<string>();
    play((intro) => {
      const card = intro.card();
      if (card) lines.add(card.line);
    });
    expect(lines.size).toBe(10);
    for (const line of lines) expect(line.length).toBeGreaterThan(10);
  });

  it("shows off the moves: the ninja's ice, the captain's shield, the fire bounced back as his", () => {
    let ice = false;
    let shield = false;
    let bounced = false;
    play(({ state }) => {
      ice ||= state.blasts.some((b) => b.ownerId === "ninja" && b.length > 0);
      shield ||= state.players.some((p) => p.id === "captain" && p.shield > 0);
      bounced ||= state.flames.some((f) => f.ownerId === "captain");
    });
    expect(ice).toBe(true);
    expect(shield).toBe(true);
    expect(bounced).toBe(true);
  });

  it("introduces every playable character: each is in the scene and has its card", () => {
    const intro = new Intro();
    expect(new Set(intro.state.players.map((p) => p.character))).toEqual(new Set(CHARACTERS));
    const names = new Set<string>();
    play((i) => {
      const card = i.card();
      if (card) names.add(card.name);
    });
    expect(names.size).toBe(CHARACTERS.length);
  });

  it("the mascot opens with its mega bomb", () => {
    let mega = false;
    play(({ state }) => void (mega ||= state.bombs.some((b) => b.ownerId === "bomb" && b.mega)));
    expect(mega).toBe(true);
  });

  it("goku's kamehameha smashes the row of blocks in front of him", () => {
    let beam = false;
    const intro = play(({ state }) => {
      beam ||= state.blasts.some((b) => b.ownerId === "goku" && b.kind === "kamehameha" && b.length === 5);
    });
    expect(beam).toBe(true);
    const { width, tiles } = intro.state.grid;
    for (let x = 3; x <= 7; x++) expect(tiles[7 * width + x]).toBe(Tile.Empty);
  });

  it("naruto's rasengan knocks the mascot back down row 3", () => {
    let struck = false;
    let knocked = false;
    play(({ state }) => {
      struck ||= state.blasts.some((b) => b.ownerId === "naruto" && b.kind === "rasengan" && b.length === 1);
      const bomb = state.players.find((p) => p.id === "bomb")!;
      knocked ||= struck && playerTile(bomb).x === 9 && playerTile(bomb).y === 3 && bomb.stun > 0;
    });
    expect(struck).toBe(true);
    expect(knocked).toBe(true);
  });

  it("the spider's web wraps up goku down row 7", () => {
    let web = false;
    let wrapped = false;
    play(({ state }) => {
      web ||= state.blasts.some((b) => b.ownerId === "spider" && b.kind === "web" && b.length > 0);
      wrapped ||= state.players.some((p) => p.id === "goku" && p.webbed > 0);
    });
    expect(web).toBe(true);
    expect(wrapped).toBe(true);
  });

  it("dresses the spider in red (the seventh seat would wear the second one's black)", () => {
    expect(new Intro().colors.get("spider")).toBe(2);
  });

  it("pikachu's thunder shock leaves the spider dizzy in row 7", () => {
    let dizzy = false;
    play(({ state }) => {
      dizzy ||= state.blasts.some((b) => b.ownerId === "pikachu" && b.kind === "thunder") && state.players.some((p) => p.id === "spider" && p.stun > 0);
    });
    expect(dizzy).toBe(true);
  });

  it("keeps pikachu's blue scarf (the eighth seat would wear the third one's red)", () => {
    expect(new Intro().colors.get("pikachu")).toBe(3);
  });

  it("static's magnet drags pikachu over to him in row 7, dizzy", () => {
    let pulled = false;
    play(({ state }) => {
      const pika = state.players.find((p) => p.id === "pikachu")!;
      pulled ||= state.blasts.some((b) => b.ownerId === "static" && b.kind === "magnet") && playerTile(pika).x === 10 && playerTile(pika).y === 7 && pika.stun > 0;
    });
    expect(pulled).toBe(true);
  });

  it("the flash zips along row 3 through naruto, the mascot and thor, leaving all three dizzy", () => {
    let all = false;
    play(({ state }) => {
      const dizzy = (id: string) => state.players.find((p) => p.id === id)!.stun > 0;
      all ||= state.blasts.some((b) => b.ownerId === "flash" && b.kind === "flash") && dizzy("naruto") && dizzy("bomb") && dizzy("thor");
    });
    expect(all).toBe(true);
  });

  it("dresses the flash in red", () => {
    expect(new Intro().colors.get("flash")).toBe(2);
  });

  it("keeps static's blue coat", () => {
    expect(new Intro().colors.get("static")).toBe(3);
  });

  it("thor's bolt leaves the mascot dizzy", () => {
    let bolt = false;
    let dizzy = false;
    play(({ state }) => {
      bolt ||= state.blasts.some((b) => b.ownerId === "thor" && b.kind === "lightning" && b.length > 0);
      dizzy ||= state.players.some((p) => p.id === "bomb" && p.stun > 0);
    });
    expect(bolt).toBe(true);
    expect(dizzy).toBe(true);
  });

  it("plays inside the zoomed window of the arena", () => {
    const inside = (x: number, y: number) =>
      x >= INTRO_VIEW.x && x < INTRO_VIEW.x + INTRO_VIEW.width && y >= INTRO_VIEW.y && y < INTRO_VIEW.y + INTRO_VIEW.height;
    play(({ state }) => {
      for (const p of state.players) expect(inside(playerTile(p).x, playerTile(p).y)).toBe(true);
      for (const f of state.flames) expect(inside(f.x, f.y)).toBe(true);
    });
    expect(INTRO_VIEW.height).toBeLessThan(11);
  });

  it("nobody gets hurt", () => {
    const intro = play();
    expect(intro.state.players.every((p) => p.alive && p.frozen === 0)).toBe(true);
  });

  it("seats them for the arena colors of the title lineup: white captain (his navy suit), black bomb, red ninja, blue thor, green goku, white naruto (his navy jacket), then the spider, pikachu, static and the flash", () => {
    expect(new Intro().state.players.map((p) => p.character)).toEqual(["captain", "bomb", "ninja", "thor", "goku", "naruto", "spider", "pikachu", "static", "flash"]);
  });

  it(`ends after ${INTRO_TICKS / 60} seconds and then stays put`, () => {
    const intro = play();
    expect(intro.state.tick).toBe(INTRO_TICKS);
    intro.advance();
    expect(intro.state.tick).toBe(INTRO_TICKS);
  });
});

describe("introDue", () => {
  const store = () => {
    const data = new Map<string, string>();
    return { get: (k: string) => data.get(k) ?? null, set: (k: string, v: string) => void data.set(k, v) };
  };

  it("plays once per session", () => {
    const s = store();
    expect(introDue(s)).toBe(true);
    expect(introDue(s)).toBe(false);
    expect(introDue(store())).toBe(true);
  });
});
