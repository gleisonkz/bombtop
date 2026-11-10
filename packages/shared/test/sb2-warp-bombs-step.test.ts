import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { TILE } from "../src/constants";
import { sb2NativeFramesAfterTicks } from "../src/sb2-native-clock";
import { sb2NativeCounter } from "../src/sb2-stage";
import { SB2_STAGE_CAPTURES } from "../src/sb2-stage-captures";
import { step } from "../src/step";
import { ItemKind, Tile } from "../src/state";
import { SB2_ITEM_SPEEDS } from "../src/sb2-items";

interface Sample {
  battle_clock?: import("../src/sb2-battle-clock").Sb2BattleClock;
  closure?: import("../src/sb2-battle-clock").Sb2ClosureClock;
  index: number;
  frame: number;
  players: { x: number; y: number; state_word: number; vx?: number; vy?: number;
    mode_word?: number; latches?: number; facing?: number;
    jump_target_y?: number;
    inventory?: { speed: number; capacity: number; fire: number; kick?: number; glove?: number } }[];
  mobile_bombs?: { x: number; y: number; entry_latch: number; cell_word: number; raw_hex: string }[];
  jump_proxies?: { owner: number; x: number; y: number }[];
  airborne_items?: { owner: number; x: number; y: number; glyph: number; raw_hex: string }[];
  thrown_bombs?: { x: number; y: number; raw_hex: string }[];
  player_reservations?: number[];
  random_history?: number[];
  transport_phase?: number;
  tunnel_gate_word?: number;
  tunnel_gate_owners?: number[];
  player_contact_word?: number;
  grid: number[][];
  buttons: string[];
  buttons2?: string[];
  phase?: number;
  seed?: number;
  word?: number;
  item_bag?: number[];
  items?: { x: number; y: number; glyph: number }[];
  bombs?: { x: number; y: number; owner: number; range?: number }[];
  channel_clock?: { index: number; timer: number };
}
interface FloorSample { records: { background: number; animation: number; interval: number; timer: number }[] }
const floorEffects: Record<string, FloorSample[]> = Object.assign({}, ...[
  "SB2-STAGE12-FLOOR-EFFECTS-REPLAY.json", "SB2-STAGE12-FLOOR-PARITY-EFFECTS-REPLAY.json",
].map(file => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8")).cases));
const padClocks: Record<string, { active: boolean; timer: number; command: number }[]> = JSON.parse(readFileSync(
  new URL("../../../docs/sb2/SB2-STAGE12-SPRING-PAD-CLOCK-REPLAY.json", import.meta.url), "utf8")).cases;
const returnStates: Record<string, { available: number[]; queue: number[] }[]> = Object.assign({}, ...[
  "SB2-STAGE12-ITEM-RETURN-QUEUE-REPLAY.json", "SB2-STAGE12-KICK-RETURN-QUEUE-REPLAY.json",
  "SB2-STAGE12-GLOVE-RETURN-QUEUE-REPLAY.json",
].map(file => JSON.parse(readFileSync(new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8")).cases));
const cases = ["SB2-WARP-BOMBS-REPLAY.json", "SB2-WARP-FLAMES-REPLAY.json", "SB2-WARP-CONTACTS-REPLAY.json",
  "SB2-WARP-MULTIPLAYER-REPLAY.json", "SB2-CHANNEL-PHASES-REPLAY.json", "SB2-CHANNEL-CONTACTS-REPLAY.json",
  "SB2-CHANNEL-EXPIRY-REPLAY.json", "SB2-CHANNEL-REPEAT-CLOCK-REPLAY.json", "SB2-CHANNEL-THREE-REPLAY.json",
  "SB2-ICE-BOMBS-REPLAY.json", "SB2-ICE-TRANSPORT-VERIFIED-REPLAY.json",
  "SB2-ICE-TRANSPORT-INTERACTIONS-REPLAY.json", "SB2-STAGE3-EXITS-VERIFIED-REPLAY.json",
  "SB2-STAGE3-OCCUPANCY-VERIFIED-REPLAY.json", "SB2-STAGE3-CONTROLS-REPLAY.json",
  "SB2-STAGE3-BOMBS-REPLAY.json", "SB2-STAGE5-FLOOR-VERIFIED-REPLAY.json",
  "SB2-STAGE9-ARROWS-REPLAY.json", "SB2-STAGE9-INTERIOR-FULL-REPLAY.json",
  "SB2-STAGE9-SIDE-FULL-REPLAY.json", "SB2-STAGE9-UP-ARROW-FULL-REPLAY.json",
  "SB2-STAGE9-LEFT-ARROW-FULL-REPLAY.json", "SB2-STAGE9-STOP-ACTIONS-FULL-REPLAY.json",
  "SB2-STAGE9-STOP-PHASE-FULL-REPLAY.json", "SB2-STAGE9-STOP-BIRTH-FULL-REPLAY.json",
  "SB2-STAGE9-REKICK-FULL-REPLAY.json", "SB2-STAGE9-PLANT-RETURN-VERIFIED-REPLAY.json",
  "SB2-STAGE9-BOMB-MEET-FULL-REPLAY.json", "SB2-STAGE9-DUAL-MOBILE-FULL-REPLAY.json",
  "SB2-STAGE10-JUMP-CONTROLS-CLASSIFIED-REPLAY.json", "SB2-STAGE10-JUMP-DIRECTIONS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-JUMP-EDGES-CLASSIFIED-REPLAY.json", "SB2-STAGE10-JUMP-PLANT-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-JUMP-FIRE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-JUMP-BOMB-LANDING-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-JUMP-BOMB-DIRECTIONS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-JUMP-OBSTACLES-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-ESCAPE-FIRE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE10-BORDER-PAIR-CLASSIFIED-REPLAY.json",
  "SB2-STAGE11-EDGE-CONTROLS-CLASSIFIED-REPLAY.json", "SB2-STAGE11-EDGE-CHARGE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE11-CHARGE-BOMBS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE11-LANDING-PAIR-CLASSIFIED-REPLAY.json", "SB2-STAGE11-FINAL-FIRE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-INITIAL-CONTROLS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-SPRING-CONTROLS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-LAUNCH-DIRECTIONS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-CENTER-ENTRY-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-CENTER-GATE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-FLOOR-REGISTERS-160-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-FLOOR-PARITY-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-SPRING-FIRE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-INVENTORY-PAIR-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-INVENTORY-EXPANSION-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-ITEM-RETURN-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-KICK-INVENTORY-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-CONTROLS-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-LIFECYCLES-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-FUSE-BOUNDARY-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-FUSE-BOUNDARY-FULL-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-VERTICAL-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-CONTACTS-EARLY-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-CLOSURE-CLOCK-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-GLOVE-CONTACTS-CLOCK-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-CLOSURE-RINGS-A-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-CLOSURE-RINGS-B-CLASSIFIED-REPLAY.json",
  "SB2-STAGE12-CLOSURE-RINGS-C-CLASSIFIED-REPLAY.json"].flatMap(file => {
  const replay: { cases: Record<string, Sample[]> } = JSON.parse(readFileSync(
    new URL(`../../../docs/sb2/${file}`, import.meta.url), "utf8"));
  // O transporte começa no estado1 capturado; o primeiro frame após load_state
  // ainda consome controles latched do estado salvo, não modelados neste replay.
  return Object.entries(replay.cases).filter(([, samples]) => samples.length > 1).map(([name, samples]) => [file.includes("GLOVE-CONTACTS-CLOCK-") ? `${name}-late` : name,
    file.startsWith("SB2-ICE-TRANSPORT-") ? samples.slice(1) : samples,
    file.startsWith("SB2-STAGE12-") ? "sb2-12" : file.startsWith("SB2-STAGE11-") ? "sb2-11" : file.startsWith("SB2-STAGE10-") ? "sb2-10" : file.startsWith("SB2-STAGE9-") ? "sb2-09" : file.startsWith("SB2-STAGE5-") ? "sb2-05" : file.startsWith("SB2-STAGE3-") ? "sb2-03" : file.startsWith("SB2-CHANNEL-") ? "sb2-04" : file.startsWith("SB2-ICE-") ? "sb2-02" : "sb2-06"] as const);
});
const tiles = (grid: number[][]) => grid.flatMap(row => row.map(code => {
  if (code === 0xc1) return Tile.Wall;
  switch (code & 63) {
    case 0: case 1: case 3: case 4: case 7: case 8: case 9: case 10: case 11: case 12: case 14: case 16: case 20: return Tile.Empty;
    case 2: return Tile.Block;
    case 5: case 6: return Tile.Wall;
    case 59: return Tile.Wall;
    case 60: case 61: case 62: case 63: return Tile.Empty;
    default: throw new Error(`Código inesperado no replay de portais: ${code}`);
  }
}));

it.each(cases)("reproduz plantio, movimento e explosão nativos em %s", (_name, samples, stage) => {
  const initial = samples[0]!;
  let s = createMatch({ stage, seed: 1, playerIds: ["p1", "p2"], maniacItems: {}, suddenDeath: false });
  s.grid.tiles = tiles(initial.grid);
  if (initial.battle_clock) s.stageState!.sb2!.battleClock = structuredClone(initial.battle_clock);
  if (initial.closure) s.stageState!.sb2!.closure = structuredClone(initial.closure);
  if (stage === "sb2-12") {
    // Estados intermediarios podem ter pisos11 consumidos antes do replay.
    const consumed = SB2_STAGE_CAPTURES[11]!.current.flatMap((row, y) => row.flatMap((code, x) =>
      (code & 63) === 11 && (initial.grid[y]![x]! & 63) === 0
        ? [{ x, y, ownerId: "p1", clock: { animation: 16, interval: 3, timer: 3, active: false } }] : []));
    if (consumed.length) s.stageState!.sb2!.stage12Floors = consumed;
  }
  s.stageState!.sb2!.counterOffset = initial.phase ?? initial.frame;
  if (initial.item_bag) Object.assign(s.stageState!.sb2!, { randomSeed: initial.seed, randomWord: initial.word,
    itemBag: { slots: [...initial.item_bag], seed: initial.seed, draws: 0 } });
  if (initial.random_history) Object.assign(s.stageState!.sb2!, { randomHistory: [...initial.random_history],
    ice: {}, iceFacing: {} });
  const glyphKinds: Record<number, ItemKind> = {
    0x1600: ItemKind.Bomb, 0x1602: ItemKind.Fire, 0x1622: ItemKind.Speed,
    0x160a: ItemKind.Skull, 0x1624: ItemKind.Kick, 0x1626: ItemKind.Glove,
    0x1606: ItemKind.FullFire, 0x1628: ItemKind.BombPass, 0x162a: ItemKind.BlockPass,
  };
  if (initial.random_history) s.items = (initial.items ?? []).map(item => ({ x: item.x, y: item.y, kind: glyphKinds[item.glyph]! }));
  s.players.forEach((player, index) => {
    player.px = (initial.players[index]!.x - 8) * TILE / 16;
    player.py = (initial.players[index]!.y - 24) * TILE / 16;
    const native = initial.players[index]!;
    const facings = { 2: "right", 4: "left", 8: "down", 16: "up" } as const;
    if (native.facing !== undefined) player.facing = facings[native.facing as keyof typeof facings];
    if (native.inventory) {
      player.bombCapacity = native.inventory.capacity;
      player.fireRange = native.inventory.fire + 1;
      player.speed = SB2_ITEM_SPEEDS[native.inventory.speed]! * TILE / 16;
      if (native.inventory.kick !== undefined) player.canKick = native.inventory.kick > 0;
      if (native.inventory.glove !== undefined) player.canGlove = native.inventory.glove > 0;
    }
    if (initial.random_history) s.stageState!.sb2!.ice![player.id] = { vx: native.vx ?? 0, vy: native.vy ?? 0 };
    if (initial.random_history) s.stageState!.sb2!.iceFacing![player.id] = player.facing;
    if (stage === "sb2-09") (s.stageState!.sb2!.stage9Velocity ??= {})[player.id] = { vx: native.vx ?? 0, vy: native.vy ?? 0 };
    if (stage === "sb2-10") (s.stageState!.sb2!.stage10 ??= {})[player.id] = {
      actionHeld: false, targetY: native.jump_target_y ?? 0, verticalFraction: Math.abs(native.vy ?? 0) % 1,
    };
  });
  // O ensaio leaving começa depois de um teleporte; a trava observada deve ser restaurada.
  if (_name === "leaving") s.stageState!.sb2!.warps = { p1: { arrival: { x: 11, y: 9 } } };
  for (const sample of samples.slice(1)) {
    const gloveControls = _name.startsWith("glove-life-")
      || ["glove-hold", "glove-repress", "glove-B", "glove-right-release"].includes(_name);
    const heldA = sample.buttons.includes("A");
    const previousA = samples[sample.index - 1]?.buttons.includes("A") ?? false;
    const dir = (["up", "down", "left", "right"] as const)
      .find(direction => sample.buttons.includes(direction.toUpperCase())) ?? null;
    const buttons2 = sample.buttons2 ?? [];
    const dir2 = (["up", "down", "left", "right"] as const)
      .find(direction => buttons2.includes(direction.toUpperCase())) ?? null;
    const before = sb2NativeFramesAfterTicks(s.tick);
    do { step(s, { p1: { dir, bomb: heldA && (!gloveControls || !previousA), hold: heldA, action: stage === "sb2-10" && sample.buttons.includes("Y"), stopKick: stage === "sb2-09" && sample.buttons.includes("X") },
      p2: { dir: dir2, bomb: buttons2.includes("A"), action: stage === "sb2-10" && buttons2.includes("Y"), stopKick: stage === "sb2-09" && buttons2.includes("X") } }); }
    while (sb2NativeFramesAfterTicks(s.tick) === before);
    s = JSON.parse(JSON.stringify(s));
    if (stage === "sb2-12") expect(sb2NativeCounter(s) & 0xffff, `contador ${sample.frame}`).toBe(sample.phase);
    if (sample.battle_clock) expect(s.stageState!.sb2!.battleClock, `relogio ${sample.frame}`).toEqual(sample.battle_clock);
    if (sample.closure) {
      expect(s.stageState!.sb2!.closure, `fechamento ${sample.frame}`).toEqual(sample.closure);
      expect(s.grid.tiles, `grade ${sample.frame}`).toEqual(tiles(sample.grid));
    }
    if (stage === "sb2-12" && floorEffects[_name]) {
      const native = floorEffects[_name]![sample.index]!.records[0]!;
      const clock = s.stageState!.sb2!.stage12Floors?.[0]?.clock;
      expect(!!clock?.active, `efeito ativo ${sample.frame}`).toBe(native.background < 0x8000);
      if (clock) expect(clock, `registro de efeito ${sample.frame}`).toEqual({
        animation: native.animation, interval: native.interval, timer: native.timer,
        active: native.background < 0x8000,
      });
    }
    if (stage === "sb2-12" && padClocks[_name]) {
      const native = padClocks[_name]![sample.index]!;
      const clock = s.stageState!.sb2!.stage12Pads?.[0]?.clock;
      expect(!!clock?.active, `pad ativo ${sample.frame}`).toBe(native.active);
      if (clock) expect(clock, `registro3D88 ${sample.frame}`).toEqual({
        active: native.active, timer: native.timer, command: native.command,
      });
    }
    if (stage === "sb2-12" && returnStates[_name] && sample.index >= 199) {
      const state = s.stageState!.sb2!.itemReturn!;
      const native = returnStates[_name]![sample.index]!;
      expect(state.available, `censo128 ${sample.frame}`).toEqual(native.available);
      const queue = [...state.queue.map((selector, index) => index < state.cursor ? 0xfffe : selector), 0xffff];
      expect(queue, `fila devolucao ${sample.frame}`).toEqual(native.queue.slice(0, queue.length));
    }
    s.players.forEach((player, index) => {
      const expected = sample.players[index]!;
      expect({ x: player.px / (TILE / 16) + 8, y: player.py / (TILE / 16) + 24 }, `frame ${sample.frame}, p${index + 1}`)
        .toEqual({ x: expected.x, y: expected.y });
      expect(player.alive, `vida ${sample.frame}, ${player.id}`).toBe(expected.state_word < 0x9800);
      if (expected.inventory) {
        expect({ capacity: player.bombCapacity, fire: player.fireRange, speed: player.speed }, `inventário ${sample.frame}, p${index + 1}`)
          .toEqual({ capacity: expected.inventory.capacity, fire: expected.inventory.fire + 1,
            speed: SB2_ITEM_SPEEDS[expected.inventory.speed]! * TILE / 16 });
        if (expected.inventory.kick !== undefined) expect(player.canKick, `chute ${sample.frame}`).toBe(expected.inventory.kick > 0);
        if (expected.inventory.glove !== undefined) expect(player.canGlove, `luva ${sample.frame}`).toBe(expected.inventory.glove > 0);
      }
      if (_name.startsWith("glove-life-contact") && player.alive && expected.latches !== undefined)
        expect(player.stun > 0, `atordoamento ${sample.frame},${player.id}`).toBe(!!(expected.latches & 0x80));
      if (stage === "sb2-02" && expected.mode_word !== undefined) {
        const transport = s.stageState!.sb2!.stage2Transport?.[player.id];
        expect(!!transport, `transporte ${sample.frame}, p${index + 1}`).toBe(!!(expected.mode_word & 0x800));
        if (transport) {
          expect(!!transport.preparation).toBe(!(expected.latches! & 0x100));
          expect(!!transport.exit).toBe(!!(expected.latches! & 0x1000));
        }
        const facings = { 2: "right", 4: "left", 8: "down", 16: "up" } as const;
        expect(player.facing, `direção ${sample.frame}, p${index + 1}`).toBe(facings[expected.facing as keyof typeof facings]);
      }
      if (stage === "sb2-03") {
        expect(!!s.stageState!.sb2!.stage3?.tunnels[player.id]).toBe(!!(expected.mode_word! & 0x400));
        const facings = { 2: "right", 4: "left", 8: "down", 16: "up" } as const;
        expect(player.facing, `direção de túnel ${sample.frame}, p${index + 1}`)
          .toBe(facings[expected.facing as keyof typeof facings]);
      }
      if (stage === "sb2-10") {
        const control = s.stageState!.sb2!.stage10?.[player.id];
        expect(!!control?.jump, `voo ${sample.frame}, ${player.id}`).toBe(!!(expected.mode_word! & 1));
        expect(!!(control?.boundary || control?.escape), `controle forçado ${sample.frame}, ${player.id}`).toBe(!!(expected.latches! & 8));
        expect(control?.targetY ?? 0, `alvo ${sample.frame}, ${player.id}`).toBe(expected.jump_target_y);
      }
      if (stage === "sb2-11") {
        const control = s.stageState!.sb2!.stage11?.[player.id];
        const facings = { 2: "right", 4: "left", 8: "down", 16: "up" } as const;
        expect(player.facing, `direcao ${sample.frame}, ${player.id}`)
          .toBe(facings[expected.facing as keyof typeof facings]);
        expect(!!control?.flight, `lancamento ${sample.frame}, ${player.id}`).toBe(!!(expected.mode_word! & 0x80));
        expect(!!control?.preparation, `preparacao ${sample.frame}, ${player.id}`)
          .toBe(!!(expected.mode_word! & 0x40) && !(expected.mode_word! & 0x80));
      }
      if (stage === "sb2-12") {
        const control = s.stageState!.sb2!.stage12?.[player.id];
        expect(!!control?.preparation, `preparo12 ${sample.frame}, ${player.id}`)
          .toBe(expected.state_word < 0x9800 && !!(expected.latches! & 0x800)
            && !(expected.latches! & 0x1000) && !(expected.latches! & 8));
        expect(!!(control?.horizontal || control?.vertical || control?.neutral), `voo12 ${sample.frame}, ${player.id}`)
          .toBe(!!(expected.latches! & 0x1000));
        expect(!!control?.escape, `escape12 ${sample.frame}, ${player.id}`).toBe(!!(expected.latches! & 8));
      }
      if (stage === "sb2-02" && expected.vx !== undefined) {
        const ice = s.stageState!.sb2!.ice![player.id]!;
        expect({ vx: ice.vx, vy: ice.vy }, `velocidade ${sample.frame}, ${player.id}`)
          .toEqual({ vx: expected.vx || 0, vy: expected.vy || 0 });
      }
    });
    expect(s.grid.tiles).toEqual(tiles(sample.grid));
    if (stage === "sb2-09" && sample.player_reservations) {
      expect(s.players.map(player => {
        const cell = s.stageState!.sb2!.stage9Reservations?.[player.id];
        return cell ? (cell.y + 3) * 128 + (cell.x + 1) * 2 : 0;
      }), `reservas de jogadores ${sample.frame}`).toEqual(sample.player_reservations);
    }
    if (stage === "sb2-03") {
      let gateWord = 0;
      const owners = [0, 0];
      for (const [id, gate] of Object.entries(s.stageState!.sb2!.stage3?.tunnels ?? {})) {
        const group = gate.column === 3 ? 0 : 1;
        gateWord |= (gate.edge === "top" ? 1 : 2) << (group * 2);
        owners[group] = 0x8000 + s.players.findIndex(player => player.id === id) * 256;
      }
      expect(gateWord, `reservas ${sample.frame}`).toBe(sample.tunnel_gate_word);
      expect(owners, `autores das reservas ${sample.frame}`).toEqual(sample.tunnel_gate_owners);
      if (sample.player_contact_word !== undefined) {
        const pair = Object.keys(s.stageState!.sb2!.stage3?.contacts ?? {}).length ? 1 : 0;
        expect(pair, `contato P1/P2 ${sample.frame}`).toBe(sample.player_contact_word);
      }
    }
    const expectedBombs = sample.grid.flatMap((row, y) => row.flatMap((code, x) =>
      (code & 63) === 3 ? [`${x},${y}`] : []));
    if (sample.jump_proxies) {
      // Comparar autoria e alvo. X bruto fica preservado: a segunda ativação
      // observada atualiza o auxiliar em outra ordem, ainda não reconstruída.
      const proxies = s.players.flatMap((player, owner) => {
        if (stage === "sb2-12") {
          const control = s.stageState!.sb2!.stage12?.[player.id];
          const jump = control?.vertical;
          if (jump) {
            const startTarget = (Math.floor(jump.originY) + (jump.direction === "up" ? -48 : 48)) & 255;
            const targetDelta = ((jump.targetY - startTarget + 128) & 255) - 128;
            return [{ owner, y: Math.floor(jump.originY) + targetDelta
              + (jump.direction === "up" ? -1.375 : 1.375) * (jump.frame - 1) }];
          }
          const horizontal = control?.horizontal ?? control?.neutral;
          return horizontal ? [{ owner, y: Math.floor(horizontal.originY) }] : [];
        }
        const jump = s.stageState!.sb2!.stage10?.[player.id]?.jump;
        if (!jump) return [];
        return [{ owner, y: jump.targetY }];
      });
      expect(proxies, `auxiliares de salto ${sample.frame}`).toEqual(sample.jump_proxies.map(
        ({ owner, y }) => ({ owner, y })));
    }
    if (stage === "sb2-12" && sample.airborne_items) {
      expect((s.stageState!.sb2!.stage12AirItems ?? []).map(item => ({
        owner: Number(item.ownerId.slice(1)) - 1, x: item.motion.flight.x, y: item.motion.flight.y,
        glyph: Number(Object.entries(glyphKinds).find(([, kind]) => kind === item.kind)?.[0]),
        pointer: item.motion.path + item.motion.flight.command * 6,
      })), `itens aereos ${sample.frame}; fusiveis ${s.bombs.map(b => b.fuse)}`).toEqual(sample.airborne_items.map(item => ({
        owner: item.owner, x: item.x, y: item.y, glyph: item.glyph,
        pointer: Buffer.from(item.raw_hex, "hex").readUIntLE(0x43, 3),
      })));
    }
    const staticBombs = s.bombs.filter(bomb => !bomb.sb2Motion && !bomb.air && !bomb.heldBy);
    if (sample.thrown_bombs) {
      expect(s.bombs.filter(b => b.sb2Throw).map(b => ({
        x: b.sb2Throw!.flight.x, y: b.sb2Throw!.flight.y,
        pointer: b.sb2Throw!.path + b.sb2Throw!.flight.command * 6,
      })), `arremesso ${sample.frame}`).toEqual(sample.thrown_bombs.map(b => ({ x: b.x, y: b.y,
        pointer: Buffer.from(b.raw_hex, "hex").readUIntLE(0x43, 3) })));
    }
    if (sample.mobile_bombs) {
      expect(s.bombs.filter(bomb => bomb.sb2Motion).map(bomb => ({
        x: bomb.sb2Motion!.px / (TILE / 16) + 8, y: bomb.sb2Motion!.py / (TILE / 16) + 24,
        entry_latch: bomb.sb2Motion!.arrowLatch ?? 0,
        cell_word: bomb.sb2Motion!.occupied
          ? (bomb.sb2Motion!.occupied.y + 3) * 128 + (bomb.sb2Motion!.occupied.x + 1) * 2 : 0,
        reservation: bomb.sb2Motion!.reservation
          ? (bomb.sb2Motion!.reservation.y + 3) * 128 + (bomb.sb2Motion!.reservation.x + 1) * 2 : 0,
      })), `bombas móveis no frame ${sample.frame}`).toEqual(sample.mobile_bombs.map(bomb => ({
        x: bomb.x, y: bomb.y, entry_latch: bomb.entry_latch, cell_word: bomb.cell_word,
        reservation: Buffer.from(bomb.raw_hex, "hex").readUInt16LE(0x4c),
      })));
    }
    expect(staticBombs.map(bomb => `${bomb.x},${bomb.y}`).sort(), `bombas no frame ${sample.frame}; fusiveis ${staticBombs.map(bomb => bomb.fuse)}`)
      .toEqual(expectedBombs.sort());
    if (sample.bombs) {
      expect(staticBombs.map(bomb => `${bomb.x},${bomb.y},${bomb.ownerId}`).sort(), `autores no frame ${sample.frame}`)
        .toEqual(sample.bombs.map(bomb => `${bomb.x},${bomb.y},p${bomb.owner + 1}`).sort());
      if (sample.bombs.every(bomb => bomb.range !== undefined)) {
        expect(staticBombs.map(bomb => `${bomb.x},${bomb.y},${bomb.range}`).sort(), `alcance no frame ${sample.frame}`)
          .toEqual(sample.bombs.map(bomb => `${bomb.x},${bomb.y},${bomb.range}`).sort());
      }
    } else expect(s.bombs.every(bomb => bomb.ownerId === "p1")).toBe(true);
    const expectedFire = sample.grid.flatMap((row, y) => row.flatMap((code, x) =>
      (code & 63) === 1 && !(code & 0x80) ? [`${x},${y}`] : []));
    expect(s.flames.filter(flame => !flame.block).map(flame => `${flame.x},${flame.y}`).sort(), `chamas no frame ${sample.frame}; fusiveis ${s.bombs.map(b => b.fuse)}`)
      .toEqual(expectedFire.sort());
    if (sample.item_bag) {
      expect(s.stageState!.sb2!.itemBag!.slots).toEqual(sample.item_bag);
      expect(s.stageState!.sb2!.randomSeed, `semente ${sample.frame}`).toBe(sample.seed);
      expect(s.stageState!.sb2!.randomWord).toBe(sample.word);
      if (sample.random_history) expect(s.stageState!.sb2!.randomHistory).toEqual(sample.random_history);
    }
    if (sample.channel_clock && stage === "sb2-04") {
      expect(s.stageState!.sb2!.channel?.clock ?? { index: -1, timer: 0 }, `relógio no frame ${sample.frame}`)
        .toEqual(sample.channel_clock);
    }
    if (sample.items) {
      const kinds: Record<number, ItemKind> = { 0x1600: ItemKind.Bomb, 0x1602: ItemKind.Fire, 0x1622: ItemKind.Speed,
        0x160a: ItemKind.Skull, 0x1626: ItemKind.Glove, 0x1624: ItemKind.Kick, 0x1606: ItemKind.FullFire,
        0x1628: ItemKind.BombPass, 0x162a: ItemKind.BlockPass };
      // O fixture lê a grade em ordem espacial; não registra uma ordem nativa
      // de objetos. Compara todas as posições/tipos, inclusive multiplicidade.
      const order = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x;
      expect(s.items.map(item => ({ x: item.x, y: item.y, kind: item.kind })).sort(order))
        .toEqual(sample.items.map(item => ({ x: item.x, y: item.y, kind: kinds[item.glyph] })).sort(order));
    }
  }
});
