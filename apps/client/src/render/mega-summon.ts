import { FUSE_TICKS, MEGA_COOLDOWN, type Bomb, type Player, type PublicView } from "@bombtop/shared";
import type { Graphics } from "pixi.js";
import { specialInk } from "./special-palette";

const AMBER = 0xffb63c;
const VIOLET = 0x985bdb;
const CORE = 0xffefb9;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

interface SummonInput {
  bomb: Bomb;
  owner: Pick<Player, "alive" | "character" | "specialCooldown"> | undefined;
  animate?: boolean;
  elapsed?: number;
}

const plantedMega = (bomb: Bomb) => bomb.mega && !bomb.heldBy && !bomb.air && !bomb.slide && bomb.offset === 0;

export function megaSummonLook({ bomb, owner, animate = true, elapsed }: SummonInput) {
  if (!animate || !plantedMega(bomb) || !owner?.alive || owner.character !== "bomb") return null;
  const age = elapsed ?? Math.max(FUSE_TICKS - bomb.fuse, MEGA_COOLDOWN - owner.specialCooldown);
  if (!Number.isFinite(age) || age < 0 || age >= 36) return null;
  const rise = 1 - Math.pow(1 - clamp((age - 8) / 14), 3);
  return {
    age,
    scale: 0.82 + rise * 0.18,
    rise: (1 - rise) * 2.5,
    alpha: 0.8 + rise * 0.2,
    charge: Math.sin(clamp(age / 12) * Math.PI),
    shock: clamp((age - 12) / 20),
    shake: age >= 12 && age < 18 ? 0.65 * Math.pow(1 - (age - 12) / 6, 2) : 0,
  };
}

export type MegaSummonLook = NonNullable<ReturnType<typeof megaSummonLook>>;

type SummonView = Pick<PublicView, "players" | "bombs" | "tick">;
interface SummonRecord {
  castAt: number;
  bornAt: number;
  x: number;
  y: number;
  cancelled: boolean;
}

export class MegaSummonEffects {
  private readonly records = new Map<string, SummonRecord>();
  private readonly frame = new Map<Bomb, MegaSummonLook>();
  private lastTick: number | null = null;

  reset(): void {
    this.records.clear();
    this.frame.clear();
    this.lastTick = null;
  }

  get(bomb: Bomb): MegaSummonLook | null {
    return this.frame.get(bomb) ?? null;
  }

  observe(view: SummonView, animate = true): void {
    if (this.lastTick !== null && view.tick < this.lastTick) this.reset();
    this.lastTick = view.tick;
    this.frame.clear();
    const owners = new Set(view.players.map((p) => p.id));
    for (const id of this.records.keys()) if (!owners.has(id)) this.records.delete(id);
    for (const owner of view.players) this.observeCaster(owner, view, animate);
  }

  private observeCaster(owner: SummonView["players"][number], view: SummonView, animate: boolean): void {
    const castAge = MEGA_COOLDOWN - owner.specialCooldown;
    if (!owner.alive || owner.character !== "bomb" || !Number.isFinite(castAge) || castAge < 0 || castAge >= 36) {
      this.records.delete(owner.id);
      return;
    }
    const castAt = view.tick - castAge;
    let record = this.records.get(owner.id);
    if (!record || Math.abs(castAt - record.castAt) > 36) record = this.begin(owner.id, view, castAt, castAge);
    if (!record || record.cancelled) return;
    const age = view.tick - record.bornAt;
    const expectedFuse = FUSE_TICKS - age;
    const bomb = view.bombs.find((b) => b.ownerId === owner.id && b.x === record.x && b.y === record.y && plantedMega(b) && Math.abs(b.fuse - expectedFuse) <= 2);
    if (!bomb) {
      record.cancelled = true;
      return;
    }
    const look = megaSummonLook({ bomb, owner, animate, elapsed: age });
    if (look) this.frame.set(bomb, look);
  }

  private begin(ownerId: string, view: SummonView, castAt: number, castAge: number): SummonRecord | undefined {
    let chosen: Bomb | undefined;
    let bestScore = 2;
    for (const bomb of view.bombs) {
      if (bomb.ownerId !== ownerId || !plantedMega(bomb)) continue;
      const score = Math.abs(FUSE_TICKS - bomb.fuse - castAge - 1);
      if (score <= bestScore) { chosen = bomb; bestScore = score; }
    }
    if (!chosen) return undefined;
    const record = { castAt, bornAt: view.tick - (FUSE_TICKS - chosen.fuse), x: chosen.x, y: chosen.y, cancelled: false };
    this.records.set(ownerId, record);
    return record;
  }
}

interface SummonDraw {
  ground: Graphics;
  overlay: Graphics;
  cx: number;
  cy: number;
  look: MegaSummonLook;
  color?: number | null;
}

export function drawMegaSummon({ ground, overlay, cx, cy, look, color }: SummonDraw): void {
  const { age, charge, shock } = look;
  const amber = specialInk(AMBER, color);
  const violet = specialInk(VIOLET, color);
  const core = specialInk(CORE, color);
  if (age < 12) {
    const radius = 11 - age / 3;
    ground.ellipse(cx, cy + 4, radius, radius * 0.33).fill({ color: violet, alpha: 0.12 + charge * 0.14 });
    ground.ellipse(cx, cy + 4, radius, radius * 0.33).stroke({ color: violet, alpha: 0.3 + charge * 0.4, width: 0.8 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + age * 0.04;
      const distance = 12 * (1 - age / 12) + 2;
      const x = cx + Math.cos(angle) * distance;
      const y = cy + 3 + Math.sin(angle) * distance * 0.35 - charge * 5;
      overlay.circle(x, y, 0.65).fill({ color: amber, alpha: charge * 0.9 });
    }
    for (const side of [-1, 1]) {
      overlay.circle(cx + side * 5, cy, 1.8).fill({ color: amber, alpha: charge * 0.35 });
      overlay.circle(cx + side * 5, cy, 0.7).fill({ color: core, alpha: charge * 0.8 });
    }
  }
  if (age < 12 || shock >= 1) return;
  const fade = Math.pow(1 - shock, 2);
  const radius = 6 + shock * 13;
  ground.ellipse(cx, cy + 4, radius, radius * 0.3).stroke({ color: amber, alpha: fade * 0.75, width: 1.3 * (1 - shock) + 0.2 });
  ground.ellipse(cx, cy + 4, radius * 0.72, radius * 0.2).stroke({ color: violet, alpha: fade * 0.4, width: 0.7 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + 4 + Math.sin(angle) * radius * 0.3 - Math.sin(shock * Math.PI) * 2;
    ground.circle(x, y, 0.8 + shock).fill({ color: 0x947a91, alpha: fade * 0.5 });
    if (i % 2 === 0) {
      overlay.moveTo(cx + Math.cos(angle) * 3, cy + 3 + Math.sin(angle));
      overlay.lineTo(cx + Math.cos(angle) * (5 + shock * 6), cy + 3 + Math.sin(angle) * (2 + shock * 2));
      overlay.stroke({ color: core, alpha: fade * 0.6, width: 0.65 });
    }
  }
}
