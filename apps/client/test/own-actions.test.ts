import { describe, expect, it } from "vitest";
import { BLAST_TICKS, createMatch, ItemKind, publicView, TICK_RATE, TILE, type Player, type PublicView } from "@bombtop/shared";
import { actionCues } from "../src/audio/local-cues";
import { GhostBlasts, GhostPickups, predictBlast } from "../src/net/own-actions";

function view(character: "ninja" | "bomb" = "ninja"): PublicView {
  return publicView(createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0, characters: { me: character } }));
}
const me = (v: PublicView): Player => structuredClone(v.players[0]!);
const TICK_MS = 1000 / TICK_RATE;

describe("ice blast, predicted", () => {
  it("is heard the moment the button is pressed, when the special is ready", () => {
    const v = view();
    expect(actionCues(v, me(v), { dir: null, bomb: false, special: true }).map((c) => c.name)).toEqual(["ice"]);
  });

  it("stays quiet while recharging or for characters without one", () => {
    const v = view();
    const p = me(v);
    p.specialCooldown = 10;
    expect(actionCues(v, p, { dir: null, bomb: false, special: true })).toEqual([]);
    const b = view("bomb");
    expect(actionCues(b, me(b), { dir: null, bomb: false, special: true })).toEqual([]);
  });

  it("works out the blast the server will make, from our predicted player", () => {
    const v = view();
    const p = me(v);
    p.facing = "right";
    expect(predictBlast(v, p)).toMatchObject({ ownerId: "me", x: 1, y: 1, dir: "right", ttl: BLAST_TICKS });
  });

  it("draws our blast at once, ages it, and hands over to the server's copy", () => {
    const v = view();
    const ghosts = new GhostBlasts("me");
    const blast = predictBlast(v, me(v))!;
    ghosts.add(blast, 0);
    expect(ghosts.active(0)).toBe(true);
    expect(ghosts.apply(v, 10 * TICK_MS).blasts).toEqual([{ ...blast, ttl: BLAST_TICKS - 10 }]);
    const confirmed = { ...v, blasts: [{ ...blast, ttl: BLAST_TICKS - 12 }] };
    expect(ghosts.apply(confirmed, 12 * TICK_MS).blasts).toEqual(confirmed.blasts);
    expect(ghosts.active(12 * TICK_MS)).toBe(false);
  });

  it("lets a blast the server never made fade out", () => {
    const v = view();
    const ghosts = new GhostBlasts("me");
    ghosts.add(predictBlast(v, me(v))!, 0);
    expect(ghosts.apply(v, (BLAST_TICKS + 1) * TICK_MS).blasts).toEqual([]);
  });
});

describe("GhostPickups", () => {
  const withItem = (kind = ItemKind.Fire) => {
    const v = view();
    v.items.push({ x: 1, y: 1, kind });
    return v;
  };

  it("takes the item under our predicted player at once, with its sound", () => {
    const v = withItem();
    const g = new GhostPickups();
    expect(g.check(v, me(v), 0)).toEqual([{ name: "pickup", x: 1.5 }]);
    expect(g.apply(v, 0).items).toEqual([]);
    expect(g.check(v, me(v), 16)).toEqual([]); // once
  });

  it("does not take items we only walk near", () => {
    const v = withItem();
    const p = me(v);
    p.px = 2 * TILE + TILE / 2;
    expect(new GhostPickups().check(v, p, 0)).toEqual([]);
  });

  it("hides a skull without a pickup sound (the curse has its own)", () => {
    const v = withItem(ItemKind.Skull);
    const g = new GhostPickups();
    expect(g.check(v, me(v), 0)).toEqual([]);
    expect(g.apply(v, 0).items).toEqual([]);
  });

  it("forgets the item once the server agrees, and gives it back if it never does", () => {
    const v = withItem();
    const g = new GhostPickups();
    g.check(v, me(v), 0);
    expect(g.apply({ ...v, items: [] }, 100).items).toEqual([]);
    expect(g.apply(v, 200).items).toHaveLength(1); // the server's view is the truth again

    const h = new GhostPickups();
    h.check(v, me(v), 0);
    expect(h.apply(v, 5000).items).toHaveLength(1);
  });

  it("leaves a dead player's tile alone", () => {
    const v = withItem();
    const p = me(v);
    p.alive = false;
    expect(new GhostPickups().check(v, p, 0)).toEqual([]);
  });
});
