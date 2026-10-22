import { describe, expect, it } from "vitest";
import { CHARACTERS, getTile, Tile, type CharacterId, type MatchState } from "@bombtop/shared";
import { SHOWCASE_VIEW, specialShowcase } from "../src/game/showcase";

/** Plays one loop of a character's special scene, calling `watch` after every tick. */
function play(c: CharacterId, watch: (s: MatchState) => void = () => {}): MatchState {
  const show = specialShowcase(c);
  for (let t = 0; t < show.length; t++) {
    show.advance();
    watch(show.state);
  }
  return show.state;
}
const you = (s: MatchState) => s.players.find((p) => p.id === "you")!;
const rival = (s: MatchState) => s.players.find((p) => p.id === "rival")!;

describe("special showcase", () => {
  it("has a scene for every character, played by that character, who lives through it and uses the special", () => {
    for (const c of CHARACTERS) {
      const show = specialShowcase(c);
      expect(you(show.state).character, c).toBe(c);
      let alive = true;
      let used = false;
      play(c, (s) => {
        alive &&= you(s).alive;
        used ||= you(s).specialCooldown > 0;
      });
      expect(alive, c).toBe(true);
      expect(used, c).toBe(true);
    }
  });

  it("dresses each character in their own color (the ninja in ice blue) and the rival in another", () => {
    expect(specialShowcase("ninja").colors.get("you")).toBe(3);
    expect(specialShowcase("goku").colors.get("you")).toBe(4);
    for (const c of CHARACTERS) {
      const { colors } = specialShowcase(c);
      expect(colors.get("rival"), c).not.toBe(colors.get("you"));
    }
  });

  it("keeps the action inside the window shown", () => {
    for (const c of CHARACTERS) {
      play(c, (s) => {
        for (const p of s.players) {
          const x = p.px / 256;
          const y = p.py / 256;
          expect(x >= SHOWCASE_VIEW.x && x <= SHOWCASE_VIEW.x + SHOWCASE_VIEW.width, c).toBe(true);
          expect(y >= SHOWCASE_VIEW.y && y <= SHOWCASE_VIEW.y + SHOWCASE_VIEW.height, c).toBe(true);
        }
      });
    }
  });

  it("bomb mascot: the mega bomb breaks a block far beyond his own fire", () => {
    const show = specialShowcase("bomb");
    const [x, y] = show.target!;
    expect(getTile(show.state, x, y)).toBe(Tile.Block);
    for (let t = 0; t < show.length; t++) show.advance();
    expect(getTile(show.state, x, y)).toBe(Tile.Empty);
  });

  it("ninja: the ice freezes the rival", () => {
    let frozen = false;
    play("ninja", (s) => (frozen ||= rival(s).frozen > 0));
    expect(frozen).toBe(true);
  });

  it("captain: the shield is up while the rival's bomb blows right next to him", () => {
    let shieldedInFire = false;
    play("captain", (s) => (shieldedInFire ||= you(s).shield > 0 && s.flames.length > 0));
    expect(shieldedInFire).toBe(true);
  });

  it("thor: the bolt stuns the rival", () => {
    let stunned = false;
    play("thor", (s) => (stunned ||= rival(s).stun > 0));
    expect(stunned).toBe(true);
  });

  it("goku: the Kamehameha smashes through blocks and stuns the rival behind them", () => {
    const show = specialShowcase("goku");
    expect(getTile(show.state, 3, 5)).toBe(Tile.Block);
    let stunned = false;
    play("goku", (s) => (stunned ||= rival(s).stun > 0 && getTile(s, 3, 5) === Tile.Empty));
    expect(stunned).toBe(true);
  });

  it("naruto: the Rasengan knocks the rival back and stuns him", () => {
    const start = rival(specialShowcase("naruto").state).px;
    let pushed = false;
    play("naruto", (s) => (pushed ||= rival(s).stun > 0 && rival(s).px > start));
    expect(pushed).toBe(true);
  });

  it("spider: the web wraps the rival up, and a bomb comes while he can't run", () => {
    let bombedWhileWebbed = false;
    play("spider", (s) => (bombedWhileWebbed ||= rival(s).webbed > 0 && s.bombs.some((b) => b.ownerId === "you")));
    expect(bombedWhileWebbed).toBe(true);
  });
});
