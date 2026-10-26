import { describe, expect, it, vi } from "vitest";
import { createMatch, FUSE_TICKS, MEGA_COOLDOWN, type Bomb, type Player } from "@bombtop/shared";
import { drawMegaSummon, MegaSummonEffects, megaSummonLook } from "../src/render/mega-summon";
import type { Graphics } from "pixi.js";

const bomb: Bomb = { ownerId: "p", x: 3, y: 3, fuse: FUSE_TICKS, range: 6, type: "pierce", slide: null, offset: 0, air: null, heldBy: null, mega: true };
const owner: Pick<Player, "alive" | "character" | "specialCooldown"> = { alive: true, character: "bomb", specialCooldown: MEGA_COOLDOWN };
const at = (age: number) => megaSummonLook({ bomb: { ...bomb, fuse: FUSE_TICKS - age }, owner: { ...owner, specialCooldown: MEGA_COOLDOWN - age } });

describe("mega bomb summoning", () => {
  it("keeps an old held bomb separate when its owner summons a second one", () => {
    const effects = new MegaSummonEffects();
    const state = createMatch({ seed: 1, playerIds: ["p", "rival"], characters: { p: "bomb", rival: "thor" }, blockDensity: 0 });
    const caster = state.players[0]!;
    const old = { ...bomb, fuse: FUSE_TICKS - 1 };
    caster.specialCooldown = MEGA_COOLDOWN;
    state.tick = 1; state.bombs = [old];
    effects.observe(state);
    expect(effects.get(old)).not.toBeNull();
    old.heldBy = "p";
    state.tick = 2; caster.specialCooldown--;
    effects.observe(state);
    const fresh = { ...bomb, x: 5, y: 5, fuse: FUSE_TICKS - 1 };
    state.tick = 1501; caster.specialCooldown = MEGA_COOLDOWN; state.bombs = [old, fresh];
    effects.observe(state);
    expect(effects.get(fresh)).not.toBeNull();
    old.heldBy = null; old.fuse = FUSE_TICKS - 2;
    fresh.fuse = FUSE_TICKS - 19;
    state.tick += 18; caster.specialCooldown -= 18;
    effects.observe(state);
    expect(effects.get(old)).toBeNull();
    expect(effects.get(fresh)!.age).toBe(19);
    effects.reset();
    expect(effects.get(fresh)).toBeNull();
  });

  it("consumes reduced-motion observations, cancels moving bombs and resets on rollback", () => {
    const effects = new MegaSummonEffects();
    const state = createMatch({ seed: 2, playerIds: ["p", "rival"], characters: { p: "bomb", rival: "thor" }, blockDensity: 0 });
    const caster = state.players[0]!;
    const current = { ...bomb, fuse: FUSE_TICKS - 8 };
    state.bombs = [current]; state.tick = 8; caster.specialCooldown = MEGA_COOLDOWN - 7;
    effects.observe(state, false);
    expect(effects.get(current)).toBeNull();
    state.tick = 14; caster.specialCooldown -= 6; current.fuse -= 6;
    effects.observe(state);
    expect(effects.get(current)!.age).toBe(14);
    current.slide = "right";
    state.tick++; caster.specialCooldown--; current.fuse--;
    effects.observe(state);
    current.slide = null;
    state.tick++; caster.specialCooldown--; current.fuse--;
    effects.observe(state);
    expect(effects.get(current)).toBeNull();
    state.tick = 1; caster.specialCooldown = MEGA_COOLDOWN; current.fuse = FUSE_TICKS - 1;
    effects.observe(state);
    expect(effects.get(current)!.age).toBe(1);
  });
  it("gathers energy before the kneeling impact, then settles at full size", () => {
    expect(at(1)!.scale).toBeGreaterThan(0.75);
    expect(at(1)!.scale).toBeLessThan(1);
    expect(at(1)!.rise).toBeGreaterThan(0);
    expect(at(6)!.charge).toBeGreaterThan(0.5);
    expect(at(11)!.shake).toBe(0);
    expect(at(12)!.shake).toBeGreaterThan(0);
    expect(at(30)).toMatchObject({ scale: 1, rise: 0, alpha: 1, shake: 0 });
    expect(at(36)).toBeNull();
  });

  it("derives the same phase for repeated renders and late snapshots", () => {
    expect(at(17)).toEqual(at(17));
    expect(at(17)!.age).toBe(17);
    expect(at(80)).toBeNull();
  });

  it("does not replay a paused fuse when an old bomb lands or is put down", () => {
    expect(megaSummonLook({ bomb: { ...bomb, fuse: FUSE_TICKS - 2 }, owner: { ...owner, specialCooldown: MEGA_COOLDOWN - 100 } })).toBeNull();
    expect(megaSummonLook({ bomb: { ...bomb, heldBy: "p" }, owner })).toBeNull();
    expect(megaSummonLook({ bomb: { ...bomb, slide: "right" }, owner })).toBeNull();
  });

  it("leaves ordinary bombs, missing casters and reduced-motion rendering alone", () => {
    expect(megaSummonLook({ bomb: { ...bomb, mega: false }, owner })).toBeNull();
    expect(megaSummonLook({ bomb, owner: undefined })).toBeNull();
    expect(megaSummonLook({ bomb, owner: { ...owner, alive: false } })).toBeNull();
    expect(megaSummonLook({ bomb, owner, animate: false })).toBeNull();
  });

  it("keeps energy gathering above the floor and the impact ring below the bomb", () => {
    const drawing = () => {
      const g = { ellipse: vi.fn(), circle: vi.fn(), fill: vi.fn(), stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn() };
      for (const method of Object.values(g)) method.mockReturnValue(g);
      return g;
    };
    const ground = drawing();
    const overlay = drawing();
    const paint = (age: number) => drawMegaSummon({ ground: ground as unknown as Graphics, overlay: overlay as unknown as Graphics, cx: 56, cy: 57, look: at(age)! });
    paint(6);
    expect(ground.ellipse).toHaveBeenCalled();
    expect(overlay.circle).toHaveBeenCalled();
    expect(overlay.lineTo).not.toHaveBeenCalled();
    paint(14);
    expect(overlay.lineTo).toHaveBeenCalled();
    for (const g of [ground, overlay]) {
      for (const method of Object.values(g)) {
        expect(method.mock.calls.flat().filter((v): v is number => typeof v === "number").every(Number.isFinite)).toBe(true);
      }
    }
  });
});
