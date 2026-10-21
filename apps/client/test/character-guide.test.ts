import { describe, expect, it } from "vitest";
import { CHARACTERS, TICK_RATE } from "@bombtop/shared";
import { CHARACTER_GUIDE } from "../src/ui/character-guide";
import { CHARACTER_SHEETS, characterMoves } from "../src/ui/sheet-art";
import { CAST_TICKS_PER_FRAME, SHEETS } from "../src/render/sprites";
import { SOUNDS } from "../src/audio/sound";

describe("character guide", () => {
  it("has every character, in the game's order, with a story, the special and tips", () => {
    expect(CHARACTER_GUIDE.map((c) => c.id)).toEqual([...CHARACTERS]);
    for (const c of CHARACTER_GUIDE) {
      expect(c.name, c.id).not.toBe("");
      expect(c.title, c.id).not.toBe("");
      expect(c.story.length, c.id).toBeGreaterThan(80);
      expect(c.special.name, c.id).not.toBe("");
      expect(c.special.text.length, c.id).toBeGreaterThan(40);
      expect(c.special.tips.length, c.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("lets every character be heard: picked, special, winning and losing, all real sounds", () => {
    for (const c of CHARACTER_GUIDE) {
      expect(c.voices.map((v) => v.label), c.id).toEqual(["Escolha", "Especial", "Vitória", "Derrota"]);
      for (const v of c.voices) expect(SOUNDS[v.sound], `${c.id} ${v.sound}`).toBeDefined();
    }
  });
});

describe("character moves", () => {
  it("lists every animation a sheet has, each at its arena speed", () => {
    const s = SHEETS.goku;
    const moves = characterMoves(s);
    expect(moves.map((m) => m.label)).toEqual([
      "Parado",
      "Andando (frente)",
      "Andando (lado)",
      "Andando (costas)",
      "Carregando bomba",
      "Especial (frente)",
      "Especial (lado)",
      "Tonto",
      "Derrota",
      "Vitória",
    ]);
    const cast = moves.find((m) => m.label === "Especial (lado)")!;
    expect(cast.row).toBe(s.cast!.side.row);
    expect(cast.seconds).toBe((s.cast!.side.frames * CAST_TICKS_PER_FRAME) / TICK_RATE);
    const win = moves.find((m) => m.label === "Vitória")!;
    expect(win).toMatchObject({ row: s.lobby!.row, frames: s.lobby!.frames });
    const idle = moves[0]!;
    expect(idle.seconds).toBe((s.idle.down.frames * (s.idleTicksPerFrame ?? s.ticksPerFrame)) / TICK_RATE);
  });

  it("leaves out what a sheet does not have", () => {
    const { cast: _c, lobby: _l, stun: _s, death: _d, carryWalk: _w, ...plain } = SHEETS.bomber;
    expect(characterMoves(plain).map((m) => m.label)).toEqual(["Parado", "Andando (frente)", "Andando (lado)", "Andando (costas)"]);
  });

  it("every playable sheet has the full set", () => {
    for (const c of CHARACTERS) expect(characterMoves(CHARACTER_SHEETS[c]).length, c).toBe(10);
  });
});
