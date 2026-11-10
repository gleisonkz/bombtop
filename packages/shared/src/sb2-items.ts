import { TILE } from "./constants";
import { createSb2ItemBag, takeSb2Item } from "./sb2-item-bag";
import { nextSb2RandomWord } from "./sb2-rng";
import { sb2NativeCounter } from "./sb2-stage";
import type { Sb2ArenaNumber } from "./sb2-stage-captures";
import { ItemKind, type CurseKind, type MatchState, type Player } from "./state";

/** C5FB07: velocidades de inventário, em pixels por frame PAL. */
export const SB2_ITEM_SPEEDS = [0.5, 1.25, 1.5, 2, 2.5, 2.75, 3] as const;
/** C5EEB5: tabela normal, indexada pela palavra aleatória do frame anterior. */
export const SB2_SKULL_MODES = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 2, 4, 5, 6] as const;
export const SB2_STAGE7_SKULL_MODES = [1, 2, 3, 1, 2, 6, 1, 2, 3, 6, 3, 6, 2, 1, 3, 6] as const;
export const SB2_HEART_SKULL_MODES = [1, 4, 3, 4, 5, 6, 1, 4, 3, 4, 5, 6, 4, 4, 5, 6] as const;
export type Sb2SkullMode = typeof SB2_SKULL_MODES[number];
const SKULL_KINDS: Record<Sb2SkullMode, CurseKind> = {
  1: "invisible", 2: "diarrhea", 3: "constipation", 4: "fast", 5: "slow", 6: "weakFire",
};
const GLYPH_KINDS: Record<number, ItemKind> = {
  0x1600: ItemKind.Bomb, 0x1602: ItemKind.Fire, 0x1622: ItemKind.Speed,
  0x160a: ItemKind.Skull, 0x1626: ItemKind.Glove, 0x1624: ItemKind.Kick,
  0x1606: ItemKind.FullFire,
  0x1628: ItemKind.BombPass, 0x162a: ItemKind.BlockPass,
};

/** Inicialização das arenas internas; glifos adicionais exigem efeitos próprios. */
export function createSb2Items(seed: number, arena: Sb2ArenaNumber = 1) {
  const itemBag = createSb2ItemBag(arena, seed);
  const prime = nextSb2RandomWord(itemBag.seed);
  return { itemBag, randomSeed: prime.seed, randomWord: prime.word };
}

export function advanceSb2ItemRandom(s: MatchState): void {
  const runtime = s.stageState?.sb2;
  if (!runtime || runtime.randomSeed === undefined) return;
  const next = nextSb2RandomWord(runtime.randomSeed);
  runtime.randomSeed = next.seed;
  runtime.randomWord = next.word;
  // C00CAA escreve sempre0400 e também0400+(contador&001E).
  const history = runtime.randomHistory ??= new Array<number>(16).fill(0);
  history[0] = next.word;
  history[(sb2NativeCounter(s) & 0x1e) >> 1] = next.word;
}

export function revealSb2Item(s: MatchState, x: number, y: number): void {
  const bag = s.stageState?.sb2?.itemBag;
  if (!bag) return;
  const glyph = takeSb2Item(bag);
  if (glyph === null) return;
  const kind = GLYPH_KINDS[glyph];
  if (kind === undefined) throw new Error(`Unmapped SB2 item glyph: ${glyph}`);
  s.items.push({ x, y, kind });
}

/** Efeitos básicos da arena 1; habilidades de chute/luva usam os sistemas existentes. */
export function applySb2Item(s: MatchState, p: Player, kind: ItemKind): boolean {
  switch (kind) {
    case ItemKind.Bomb: p.bombCapacity = Math.min(p.bombCapacity + 1, 9); return true;
    case ItemKind.Fire: p.fireRange = Math.min(p.fireRange + 1, 10); return true;
    case ItemKind.FullFire: p.fireRange = 10; return true;
    case ItemKind.Speed: {
      const index = SB2_ITEM_SPEEDS.findIndex(speed => speed * (TILE / 16) === p.speed);
      p.speed = SB2_ITEM_SPEEDS[Math.min(Math.max(index, 1) + 1, 5)]! * (TILE / 16);
      return true;
    }
    case ItemKind.Kick: p.canKick = true; return true;
    case ItemKind.Glove: p.canGlove = true; return true;
    case ItemKind.BombPass: p.canBombPass = true; return true;
    case ItemKind.BlockPass: p.canBlockPass = true; return true;
    case ItemKind.Skull: {
      const table = s.stage === "sb2-07" ? SB2_STAGE7_SKULL_MODES : p.hasHeart ? SB2_HEART_SKULL_MODES : SB2_SKULL_MODES;
      const mode = table[(s.stageState?.sb2?.randomWord ?? 0) & 15]!;
      p.curse = { kind: SKULL_KINDS[mode], sb2Status: mode, elapsed: 0 };
      return true;
    }
    default: return false;
  }
}
