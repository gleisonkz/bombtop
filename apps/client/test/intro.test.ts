import { describe, expect, it } from "vitest";
import { Intro, INTRO_TICKS, introDue } from "../src/game/intro";

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
    expect(seen).toEqual(["Bomba", "Ninja", "Capitão América", "logo"]);
  });

  it("each card says what the character does", () => {
    const lines = new Set<string>();
    play((intro) => {
      const card = intro.card();
      if (card) lines.add(card.line);
    });
    expect(lines.size).toBe(3);
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

  it("nobody gets hurt", () => {
    const intro = play();
    expect(intro.state.players.every((p) => p.alive && p.frozen === 0)).toBe(true);
  });

  it("seats them for the arena colors of the title lineup: white captain (his navy suit), black bomb, red ninja", () => {
    expect(new Intro().state.players.map((p) => p.character)).toEqual(["captain", "bomb", "ninja"]);
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
