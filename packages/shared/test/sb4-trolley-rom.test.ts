import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMatch } from "../src/arena";
import { Bot } from "../src/bot";
import { placeBomb } from "../src/bombs";
import { step } from "../src/step";
import { TILE } from "../src/constants";
import { initializeStageTransport, updateStageTransport } from "../src/stage-transport";
import { Floor, placePlayerAt, playerTile, tileCenter, Tile } from "../src/state";
import centreReplays from "./fixtures/sb4-trolley-centre.json";
import nineRoutes from "./fixtures/sb4-trolley-nine-routes.json";

const NATIVE_EXIT_COORDS = [
  [[111, 111], [127, 95], [143, 111]],
  [[175, 143], [191, 127], [191, 127]],
  [[111, 207], [111, 207], [111, 207]],
] as const;

const NATIVE_EXIT_DIRECTIONS = [
  ["left", "up", "right"],
  ["left", "up", "up"],
  ["left", "left", "left"],
] as const;

const NATIVE_EXIT_ARCS = {
  left: { length: 50, sha256: "a200d35fb06ac68336b2ab2fbcdffbe23cf76cfe43d0f79e7905d1676cf24f16" },
  up: { length: 50, sha256: "022ed8a92982f4b085519c8b71825bf9798e27ed988997ccdac9230943a9f5e8" },
  right: { length: 61, sha256: "bddb4538ec7474b3c293b72018239ed0c122aff72a0c8577fab9628997d17948" },
} as const;

const NATIVE_RIDER_MOVEMENT = [
  { seed: 0, observations: [
    { tick: 44, cart: [126, 112], rider: [127, 111] },
    { tick: 45, cart: [124, 112], rider: [126, 104] },
    { tick: 60, cart: [97, 111], rider: [98, 104] },
    { tick: 62, cart: [96, 109], rider: [96, 102] },
    { tick: 64, cart: [96, 106], rider: [96, 100] },
    { tick: 129, cart: [64, 144], rider: [64, 134] },
    { tick: 160, cart: [90, 176], rider: [88, 168] },
  ] },
  { seed: 24, observations: [
    { tick: 44, cart: [128, 110], rider: [127, 111] },
    { tick: 45, cart: [128, 108], rider: [128, 102] },
    { tick: 48, cart: [128, 102], rider: [128, 96] },
    { tick: 78, cart: [125, 48], rider: [126, 40] },
    { tick: 81, cart: [120, 48], rider: [122, 40] },
    { tick: 127, cart: [32, 50], rider: [33, 41] },
    { tick: 131, cart: [32, 56], rider: [32, 46] },
    { tick: 210, cart: [35, 208], rider: [34, 200] },
    { tick: 315, cart: [128, 112], rider: [128, 106] },
    { tick: 316, cart: [128, 112], rider: [128, 104] },
  ] },
  { seed: 48, observations: [
    { tick: 44, cart: [128, 114], rider: [127, 111] },
    { tick: 45, cart: [128, 116], rider: [128, 106] },
    { tick: 48, cart: [128, 122], rider: [128, 112] },
    { tick: 80, cart: [134, 176], rider: [132, 168] },
  ] },
] as const;

const NATIVE_BOARDING_MOVEMENT = [
  { tick: 1, rider: [128, 112] },
  { tick: 2, rider: [128, 112] },
  { tick: 3, rider: [129, 110] },
  { tick: 7, rider: [133, 110] },
  { tick: 8, rider: [134, 108] },
  { tick: 9, rider: [135, 108] },
  { tick: 12, rider: [135, 108] },
  { tick: 13, rider: [135, 104] },
  { tick: 16, rider: [135, 104] },
  { tick: 17, rider: [135, 99] },
  { tick: 20, rider: [135, 93] },
  { tick: 22, rider: [135, 88] },
  { tick: 24, rider: [135, 85] },
  { tick: 26, rider: [135, 84] },
  { tick: 31, rider: [135, 84] },
  { tick: 32, rider: [135, 90] },
  { tick: 37, rider: [135, 90] },
  { tick: 38, rider: [135, 98] },
  { tick: 41, rider: [135, 98] },
  { tick: 42, rider: [135, 107] },
  { tick: 43, rider: [135, 107] },
  { tick: 44, rider: [127, 111] },
] as const;

const NATIVE_BOARDING_ENTRY_VARIANTS = [
  { nativeX: 127, nativeY: 111, sha256: "7a683d421cc4039fb72ecd6902fbb02cadf98e57b9c63948505b644eefa20171" },
  { nativeX: 120, nativeY: 111, sha256: "6fb790d93aeb66c122982fe4d3fad46937a474c1a6bc6f18bd016869e38b751f" },
  { nativeX: 135, nativeY: 111, sha256: "2f6d111e494574d4e01346d57d9ca5e385aff6f5a6d8f2273baea7a6576e892f" },
  { nativeX: 127, nativeY: 112, sha256: "6b9e6d6c36e506b49aa0b5b0bf7ef9cec3659fb158f43b6660eff043fc573284" },
  { nativeX: 127, nativeY: 119, sha256: "eae4174412359857a9666376850cf073449540bc62d4dde30f13b5996a4066c9" },
  { nativeX: 127, nativeY: 104, sha256: "0dcdc128c8efac65c099a0d71bd808ec109bccfb2fcb6a04d03b7b40873e10ec" },
  { nativeX: 124, nativeY: 112, sha256: "a1c59d564743df7788e5da4b3bb7930592ee8b7fa8bdfd7d5a500931b24ab1f9" },
  { nativeX: 132, nativeY: 112, sha256: "b0c156cda6ceba1207f2d34332bbc5e72b1f7ea6d6972f9c579fa159f02cc24f" },
  { nativeX: 128, nativeY: 111, sha256: "b5018bfb45cece25f8ba76c4efef4c0d4552de0f314b68b701f6ae908fa70ed7" },
  { nativeX: 128, nativeY: 116, sha256: "effa15b3497628f70889862da6f7ebfa231c0527bf6ef363bd64c09880afcf28" },
  { nativeX: 129, nativeY: 112, sha256: "8d0518d6e64668bf76c4c3a3e4c6a8d9247d629ff3c5790541dda7d4059bf704" },
  { nativeX: 127, nativeY: 113, sha256: "2f526a5e5d540b6b76aa285bf6c037ba9e47e67029624e79e1164477de16959a" },
  { nativeX: 127, nativeY: 108, sha256: "ad63e986bcbc66c2845052293ed237b995d9c0c656378aa498934527e51038c5" },
] as const;

const NATIVE_RIDER_REPLAYS = [
  { seed: 0, lastRidingTick: 351, sha256: "7149c82d17f71894ac57906362a13a051f08280a603b4c0ed46e01b7a43e6de4" },
  { seed: 24, lastRidingTick: 316, sha256: "e536d4bfeabcdcee5ce5a5bb767856f62f4a62727f237b922284a7855e694df8" },
  { seed: 48, lastRidingTick: 345, sha256: "23f05f5e5f17e62eccaae4c947398eea977f67431013b1cfab3f35bacd10e1b2" },
] as const;

describe("SB4 trolley controlled ROM replay A", () => {
  it.each([
    { nativeX: 134, nativeY: 113, expected: [134, 111] },
    { nativeX: 135, nativeY: 112, expected: [135, 110] },
    { nativeX: 135, nativeY: 113, expected: [27528, 8498] },
  ])("matches native coordinate changes during boarding at ($nativeX,$nativeY)", ({ nativeX, nativeY, expected }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const rider = s.players[0]!;
    const scale = TILE / 16;
    placePlayerAt(s, "a", 7, 5);
    updateStageTransport(s);
    updateStageTransport(s);
    rider.px = (nativeX - 8) * scale;
    rider.py = (nativeY - 24) * scale;
    updateStageTransport(s);
    expect([rider.px / scale + 8, rider.py / scale + 24]).toEqual(expected);
  });

  it("continues the native full boarding arc after the 0x40 table cell", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 24;
    const rider = s.players[0]!;
    const scale = TILE / 16;
    placePlayerAt(s, "a", 7, 5);
    updateStageTransport(s);
    updateStageTransport(s);
    rider.px = (135 - 8) * scale;
    rider.py = (113 - 24) * scale;
    const positions: number[][] = [];
    for (let tick = 3; tick <= 43; tick++) {
      updateStageTransport(s);
      positions.push([rider.px / scale + 8, rider.py / scale + 24]);
    }
    expect(createHash("sha256").update(JSON.stringify(positions)).digest("hex")).toBe("0757272846e66eb6617ed98b439d1f0e688d65945b592bb2f50bebbc47ef75ba");
    updateStageTransport(s);
    expect([rider.px / scale + 8, rider.py / scale + 24]).toEqual([399, 303]);
    for (let tick = 45; tick <= 62; tick++) {
      updateStageTransport(s);
      expect([rider.px / scale + 8, rider.py / scale + 24], `native recovery tick ${tick}`).toEqual([128, 192 - tick * 2]);
    }
  });

  it.each(NATIVE_BOARDING_ENTRY_VARIANTS)("matches all native boarding frames from entry ($nativeX,$nativeY)", ({ nativeX, nativeY, sha256 }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 24;
    const scale = TILE / 16;
    const rider = s.players[0]!;
    rider.px = (nativeX - 8) * scale;
    rider.py = (nativeY - 24) * scale;
    const positions: number[][] = [];
    let restored: typeof s | null = null;
    for (let tick = 1; tick <= 44; tick++) {
      updateStageTransport(s);
      if (restored) {
        updateStageTransport(restored);
        expect(restored.players[0]).toEqual(rider);
      }
      if (tick === 22) restored = JSON.parse(JSON.stringify(s)) as typeof s;
      const nativePosition = [rider.px / scale + 8 - 128, rider.py / scale + 24 - 112];
      if (tick <= 43) positions.push(nativePosition);
      else expect(nativePosition).toEqual([-1, -1]);
    }
    expect(s.stageState!.trolley!.riderId).toBe("a");
    expect(createHash("sha256").update(JSON.stringify(positions)).digest("hex")).toBe(sha256);
  });

  it.each([
    { station: 1, offsetX: -1, offsetY: -1, sha256: "7a683d421cc4039fb72ecd6902fbb02cadf98e57b9c63948505b644eefa20171" },
    { station: 1, offsetX: 0, offsetY: 0, sha256: "b9a7411ac228f055cec84d03c2c292e76a8c37d7e828e3da10b7fbb586ae65bd" },
    { station: 1, offsetX: 4, offsetY: 0, sha256: "b0c156cda6ceba1207f2d34332bbc5e72b1f7ea6d6972f9c579fa159f02cc24f" },
    { station: 2, offsetX: -1, offsetY: -1, sha256: "7a683d421cc4039fb72ecd6902fbb02cadf98e57b9c63948505b644eefa20171" },
    { station: 2, offsetX: 0, offsetY: -1, sha256: "b5018bfb45cece25f8ba76c4efef4c0d4552de0f314b68b701f6ae908fa70ed7" },
    { station: 2, offsetX: 4, offsetY: -1, sha256: "91564266fed83d027cfc5b31c1352a103bdb9e10f3d12c82112b84f900fd1244" },
  ])("matches native boarding from normalized offset ($offsetX,$offsetY) at station $station", ({ station, offsetX, offsetY, sha256 }) => {
    const replay = nineRoutes.find(route => route.station === station)!;
    const s = createMatch({ seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stage = "sb4-11";
    s.rng = replay.stationSeed;
    initializeStageTransport(s);
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = replay.routeSeed;
    const pixel = TILE / 16;
    const rider = s.players[0]!;
    rider.px = trolley.px + offsetX * pixel;
    rider.py = trolley.py + offsetY * pixel;
    const positions: number[][] = [];
    for (let tick = 1; tick <= 43; tick++) {
      updateStageTransport(s);
      positions.push([(rider.px - trolley.px) / pixel, (rider.py - trolley.py) / pixel]);
    }
    expect(trolley.riderId).toBe("a");
    expect(createHash("sha256").update(JSON.stringify(positions)).digest("hex")).toBe(sha256);
  });

  it.each([
    { riderX: 128, riderY: 112, otherX: 128, otherY: 112 },
    { riderX: 127, riderY: 111, otherX: 128, otherY: 112 },
    { riderX: 128, riderY: 112, otherX: 127, otherY: 111 },
  ])("boards the first player before another candidate and marks the second on departure", ({ riderX, riderY, otherX, otherY }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const pixel = TILE / 16;
    const [rider, other] = s.players;
    rider!.px = (riderX - 8) * pixel;
    rider!.py = (riderY - 24) * pixel;
    other!.px = (otherX - 8) * pixel;
    other!.py = (otherY - 24) * pixel;
    s.stageState!.trolley!.routeRng = 24;
    for (let tick = 1; tick <= 44; tick++) {
      updateStageTransport(s);
      expect(s.stageState!.trolley!.riderId).toBe("a");
      expect(other!.alive).toBe(true);
    }
    expect(s.stageState!.trolley!.pendingHitIds).toEqual(["b"]);
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    updateStageTransport(s);
    updateStageTransport(restored);
    expect(other!.alive).toBe(false);
    expect(restored.players[1]!.alive).toBe(false);
    expect(rider!.alive).toBe(true);
  });

  it.each([
    { nativeX: 119, nativeY: 112 },
    { nativeX: 136, nativeY: 112 },
    { nativeX: 128, nativeY: 103 },
    { nativeX: 128, nativeY: 120 },
  ])("does not board from outside the native station contact region ($nativeX,$nativeY)", ({ nativeX, nativeY }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.players[0]!.px = (nativeX - 8) * TILE / 16;
    s.players[0]!.py = (nativeY - 24) * TILE / 16;
    for (let tick = 1; tick <= 4; tick++) updateStageTransport(s);
    expect(s.stageState!.trolley!.riderId).toBeUndefined();
  });

  it.each([0, 24, 48])("matches the native 43-update boarding arc for route seed %i", seed => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = seed;
    placePlayerAt(s, "a", 7, 5);
    const offsets: number[][] = [];
    for (let tick = 1; tick <= 44; tick++) {
      updateStageTransport(s);
      const rider = s.players[0]!;
      if (tick <= 43) offsets.push([rider.px / TILE * 16 + 8 - 128, rider.py / TILE * 16 + 24 - 112]);
      const observation = NATIVE_BOARDING_MOVEMENT.find(entry => entry.tick === tick);
      if (observation) {
        expect([rider.px / TILE * 16 + 8, rider.py / TILE * 16 + 24], `boarding tick ${tick}`).toEqual(observation.rider);
      }
      if (tick <= 43) expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24]).toEqual([128, 112]);
    }
    expect(createHash("sha256").update(JSON.stringify(offsets)).digest("hex")).toBe("b9a7411ac228f055cec84d03c2c292e76a8c37d7e828e3da10b7fbb586ae65bd");
  });

  it.each(NATIVE_RIDER_REPLAYS)("replays every native passenger movement position for route seed $seed", replay => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = replay.seed;
    placePlayerAt(s, "a", 7, 5);
    const positions: number[][] = [];
    for (let tick = 1; tick <= replay.lastRidingTick; tick++) {
      updateStageTransport(s);
      if (tick < 44) continue;
      const rider = s.players[0]!;
      positions.push([rider.px / TILE * 16 + 8, rider.py / TILE * 16 + 24]);
    }
    expect(createHash("sha256").update(JSON.stringify(positions)).digest("hex")).toBe(replay.sha256);
  });

  it.each(nineRoutes)("replays native passenger disembark coordinates for $script", replay => {
    const s = createMatch({ seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stage = "sb4-11";
    s.rng = replay.stationSeed;
    initializeStageTransport(s);
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = replay.routeSeed;
    const nativeStartX = trolley.px / TILE * 16 + 8;
    const nativeStartY = trolley.py / TILE * 16 + 24;
    s.players[0]!.px = trolley.px;
    s.players[0]!.py = trolley.py;
    const direction = NATIVE_EXIT_DIRECTIONS[replay.station]![replay.variant]!;
    const arc = NATIVE_EXIT_ARCS[direction];
    const positions: number[][] = [];
    for (let tick = 1; tick < replay.exitTick; tick++) {
      updateStageTransport(s);
      if (tick < replay.exitTick - arc.length) continue;
      const rider = s.players[0]!;
      positions.push([rider.px / TILE * 16 + 8 - nativeStartX, rider.py / TILE * 16 + 24 - nativeStartY]);
    }
    expect(positions).toHaveLength(arc.length);
    expect(createHash("sha256").update(JSON.stringify(positions)).digest("hex")).toBe(arc.sha256);
  });

  it.each(nineRoutes.filter(replay => (replay.station === 0 && replay.variant === 1) || (replay.station === 1 && replay.variant !== 0)))(
    "replays the additional native passenger update on route $script before leaving", replay => {
      const s = createMatch({ seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
      s.stage = "sb4-11";
      s.rng = replay.stationSeed;
      initializeStageTransport(s);
      const trolley = s.stageState!.trolley!;
      trolley.routeRng = replay.routeSeed;
      s.players[0]!.px = trolley.px;
      s.players[0]!.py = trolley.py;
      for (let tick = 1; tick < replay.exitTick; tick++) {
        updateStageTransport(s);
        if (trolley.phase !== "leaving") continue;
        const cartX = trolley.px;
        const cartY = trolley.py;
        updateStageTransport(s);
        const rider = s.players[0]!;
        expect([rider.px, rider.py]).toEqual([cartX, cartY - TILE / 2]);
        return;
      }
      throw new Error(`Route ${replay.script} did not reach the leaving phase`);
    },
  );

  it("resumes native boarding at the correct position after a JSON snapshot", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 24;
    placePlayerAt(s, "a", 7, 5);
    for (let tick = 1; tick <= 24; tick++) updateStageTransport(s);
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    for (let tick = 25; tick <= 46; tick++) {
      updateStageTransport(s);
      updateStageTransport(restored);
      expect(restored.players[0]).toEqual(s.players[0]);
      expect(restored.stageState!.trolley).toEqual(s.stageState!.trolley);
    }
  });

  it.each(NATIVE_RIDER_MOVEMENT)("matches the moving passenger offsets measured for native route seed $seed", ({ seed, observations }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = seed;
    placePlayerAt(s, "a", 7, 5);
    for (let tick = 1; tick <= observations.at(-1)!.tick; tick++) {
      updateStageTransport(s);
      const observation = observations.find(sample => sample.tick === tick);
      if (!observation) continue;
      const nativeCart = [trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24];
      const rider = s.players[0]!;
      const nativeRider = [rider.px / TILE * 16 + 8, rider.py / TILE * 16 + 24];
      expect(nativeCart, `cart at native update ${tick}, seed ${seed}`).toEqual(observation.cart);
      expect(nativeRider, `passenger at native update ${tick}, seed ${seed}`).toEqual(observation.rider);
    }
  });

  it("keeps the native passenger trajectory deterministic after JSON snapshot restoration", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 24;
    placePlayerAt(s, "a", 7, 5);
    for (let tick = 1; tick <= 77; tick++) updateStageTransport(s);
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    for (let tick = 78; tick <= 84; tick++) {
      updateStageTransport(s);
      updateStageTransport(restored);
      expect(restored.players[0]).toEqual(s.players[0]);
      expect(restored.stageState!.trolley).toEqual(s.stageState!.trolley);
    }
  });

  it.each(nineRoutes)("runs station $station route $variant through native movement updates", replay => {
    const s = createMatch({ seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stage = "sb4-11";
    s.rng = replay.stationSeed;
    initializeStageTransport(s);
    const trolley = s.stageState!.trolley!;
    expect(trolley.routeRng).toBe([899, 22475, 44051][replay.station]);
    trolley.routeRng = replay.routeSeed;
    const start = replay.positions[0]!;
    expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24]).toEqual(start);
    Object.assign(s.players[0]!, { px: trolley.px, py: trolley.py });
    for (let tick = 1; tick <= replay.exitTick; tick++) {
      updateStageTransport(s);
      const point = replay.positions[Math.min(Math.max(0, tick - 43), replay.positions.length - 1)]!;
      expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24], `${replay.script} update ${tick}`).toEqual(point);
      if (tick < replay.exitTick) expect(trolley.riderId).toBe("a");
    }
    expect(trolley.riderId).toBeUndefined();
    expect(playerTile(s.players[0]!)).toEqual(replay.exitTile);
    const rider = s.players[0]!;
    expect([rider.px / TILE * 16 + 8, rider.py / TILE * 16 + 24]).toEqual(NATIVE_EXIT_COORDS[replay.station]?.[replay.variant]);
  });
  it.each(centreReplays)("matches every cart frame selected by native seed $seed ($script)", replay => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    Object.assign(trolley, { routeRng: replay.seed });
    placePlayerAt(s, "a", 7, 5);
    for (let tick = 1; tick <= replay.positions.length + 3; tick++) {
      updateStageTransport(s);
      expect(trolley.routeRng).toBe(replay.nextSeed);
      if (tick >= 4) expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24], `seed ${replay.seed} tick ${tick}`).toEqual(replay.positions[tick - 4]);
      if (tick < replay.exitTick) expect(trolley.riderId).toBe("a");
      else expect(trolley.riderId).toBeUndefined();
    }
    expect(playerTile(s.players[0]!)).toEqual(replay.exitTile);
    expect(trolley.riderId).toBeUndefined();
  });
  it.each([
    { script: "96ca", seed: 0, exitTick: 402, exit: [111, 111] },
    { script: "9a6a", seed: 24, exitTick: 367, exit: [127, 95] },
    { script: "9d9a", seed: 48, exitTick: 407, exit: [143, 111] },
  ])("matches the ROM player's exact native exit coordinates for $script", replay => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = replay.seed;
    expect(trolley.station).toBe(0);
    placePlayerAt(s, "a", 7, 5);
    for (let tick = 1; tick <= replay.exitTick; tick++) updateStageTransport(s);
    expect(trolley.riderId).toBeUndefined();
    const player = s.players[0]!;
    expect([player.px / TILE * 16 + 8, player.py / TILE * 16 + 24]).toEqual(replay.exit);
  });
  it("lets a bot leave a corridor before the sampled trolley trajectory arrives", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles.fill(Tile.Wall);
    for (const [x, y] of [[7, 3], [6, 3], [7, 4], [7, 5]]) s.grid.tiles[y! * 15 + x!] = Tile.Empty;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 7, 3);
    Object.assign(s.players[1]!, { bombCapacity: 0, specialCooldown: 9999 });
    s.stageState!.trolley!.routeRng = 24;
    updateStageTransport(s);
    const trolley = s.stageState!.trolley!;
    trolley.phase = "riding";
    const bot = new Bot("b", "hard");
    let escaped = false;
    for (let tick = 0; tick < 30; tick++) {
      step(s, { b: bot.input(s) });
      escaped ||= playerTile(s.players[1]!).x === 6;
    }
    expect(s.players[1]!.alive).toBe(true);
    expect(escaped).toBe(true);
  });
  it("preserves blocks on the track and starts at the measured boarding tile", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"] });
    expect(s.stageState!.trolley).toMatchObject({ px: tileCenter(7), py: tileCenter(5), dir: "up" });
    expect(s.grid.tiles[1 * 15 + 3]).toBe(Tile.Block);
    expect(s.grid.floor[1 * 15 + 3]).toBe(Floor.Rail);
    expect(s.grid.floor[1 * 15 + 13]).not.toBe(Floor.Rail);
  });

  it("matches measured positions through boarding, rounded turns and disembarking", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    initializeStageTransport(s);
    placePlayerAt(s, "a", 7, 5);
    const cart = s.stageState!.trolley!;
    cart.routeRng = 24;
    const checkpoints = new Map<number, [number, number]>([
      [1, [128, 112]], [43, [128, 112]], [44, [128, 110]],
      [73, [128, 52]], [75, [128, 50]], [77, [126, 48]],
      [79, [124, 48]], [123, [36, 48]], [129, [32, 52]],
      [205, [32, 204]], [211, [36, 208]], [223, [60, 208]],
      [259, [92, 176]], [295, [124, 144]], [315, [128, 112]],
    ]);
    for (let tick = 1; tick <= 367; tick++) {
      updateStageTransport(s);
      const expected = checkpoints.get(tick);
      if (expected) {
        expect([cart.px / TILE * 16 + 8, cart.py / TILE * 16 + 24], `ROM frame ${7985 + tick}`).toEqual(expected);
      }
      if (tick < 367) expect(cart.riderId).toBe("a");
    }
    expect(cart.riderId).toBeUndefined();
    expect(playerTile(s.players[0]!)).toEqual({ x: 7, y: 4 });
    expect([cart.px, cart.py]).toEqual([tileCenter(7), tileCenter(5)]);
  });

  it.each([
    { nativeY: 103, deathTick: 49 },
    { nativeY: 104, deathTick: 48 },
    { nativeY: 119, deathTick: 48 },
    { nativeY: 120, deathTick: null },
  ])("resolves native trolley contact at frame $deathTick for player Y=$nativeY", ({ nativeY, deathTick }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = 24;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 12, 9);
    for (let tick = 1; tick <= 46; tick++) updateStageTransport(s);
    expect(trolley.py / TILE * 16 + 24).toBe(106);
    const opponent = s.players[1]!;
    opponent.px = (127 - 8) * TILE / 16;
    opponent.py = (nativeY - 24) * TILE / 16;
    for (let tick = 47; tick <= 50; tick++) {
      updateStageTransport(s);
      expect(trolley.py / TILE * 16 + 24).toBe(198 - tick * 2);
      expect(opponent.alive, `native update ${tick}, opponent Y=${nativeY}`).toBe(deathTick === null || tick < deathTick);
      if (nativeY === 119 && tick === 47) {
        const restored = JSON.parse(JSON.stringify(s)) as typeof s;
        placePlayerAt(restored, "b", 12, 9);
        updateStageTransport(restored);
        expect(restored.players[1]!.alive).toBe(false);
      }
    }
  });

  it("keeps contact with the departing native tile through the boundary frame", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = 24;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 12, 9);
    for (let tick = 1; tick <= 47; tick++) updateStageTransport(s);
    expect(trolley.py / TILE * 16 + 24).toBe(104);
    const opponent = s.players[1]!;
    opponent.px = (127 - 8) * TILE / 16;
    opponent.py = (119 - 24) * TILE / 16;
    updateStageTransport(s);
    expect(trolley.py / TILE * 16 + 24).toBe(102);
    expect(opponent.alive).toBe(true);
    updateStageTransport(s);
    expect(opponent.alive).toBe(false);
  });

  it.each([
    { nativeX: 111, deathTick: 84 },
    { nativeX: 127, deathTick: 83 },
  ])("matches contact timing across the native horizontal boundary at X=$nativeX", ({ nativeX, deathTick }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = 24;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 12, 9);
    for (let tick = 1; tick <= 81; tick++) updateStageTransport(s);
    expect([trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24]).toEqual([120, 48]);
    const opponent = s.players[1]!;
    opponent.px = (nativeX - 8) * TILE / 16;
    opponent.py = (47 - 24) * TILE / 16;
    for (let tick = 82; tick <= 85; tick++) {
      updateStageTransport(s);
      expect(opponent.alive, `native horizontal update ${tick}, X=${nativeX}`).toBe(tick < deathTick);
    }
  });

  it.each([
    { direction: "down", tickBefore: 130, nativeX: 31, nativeY: 47, before: [32, 54], after: [32, 56] },
    { direction: "down", tickBefore: 130, nativeX: 31, nativeY: 63, before: [32, 54], after: [32, 56] },
    { direction: "right", tickBefore: 212, nativeX: 31, nativeY: 207, before: [38, 208], after: [40, 208] },
    { direction: "right", tickBefore: 212, nativeX: 47, nativeY: 207, before: [38, 208], after: [40, 208] },
  ])("marks native $direction boundary contact at ($nativeX,$nativeY) before applying damage", ({ tickBefore, nativeX, nativeY, before, after }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = 24;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 12, 9);
    for (let tick = 1; tick <= tickBefore; tick++) updateStageTransport(s);
    const coordinates = () => [trolley.px / TILE * 16 + 8, trolley.py / TILE * 16 + 24];
    expect(coordinates()).toEqual(before);
    const opponent = s.players[1]!;
    opponent.px = (nativeX - 8) * TILE / 16;
    opponent.py = (nativeY - 24) * TILE / 16;
    updateStageTransport(s);
    expect(coordinates()).toEqual(after);
    expect(opponent.alive).toBe(true);
    updateStageTransport(s);
    expect(opponent.alive).toBe(false);
  });

  it.each([
    { targetY: 4, contactTick: 48, explosionTick: 49 },
    { targetY: 2, contactTick: 64, explosionTick: 65 },
  ])("delays trolley-triggered bomb detonation until native update $explosionTick", ({ targetY, contactTick, explosionTick }) => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 24;
    s.grid.tiles[targetY * s.grid.width + 7] = Tile.Empty;
    placePlayerAt(s, "a", 7, 5);
    placePlayerAt(s, "b", 7, targetY);
    expect(placeBomb(s, "b")).toBe(true);
    placePlayerAt(s, "b", 12, 9);
    for (let tick = 1; tick < contactTick; tick++) step(s);
    expect(s.bombs).toHaveLength(1);
    step(s);
    expect(s.tick).toBe(contactTick);
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]!.trolleyContactPending).toBe(true);
    expect(s.flames.some(flame => flame.x === 7 && flame.y === targetY)).toBe(false);
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    step(restored);
    expect(restored.tick).toBe(explosionTick);
    expect(restored.bombs).toHaveLength(0);
    expect(restored.flames.some(flame => flame.x === 7 && flame.y === targetY)).toBe(true);
    step(s);
    expect(s.tick).toBe(explosionTick);
    expect(s.bombs).toHaveLength(0);
    expect(s.flames.some(flame => flame.x === 7 && flame.y === targetY)).toBe(true);
  });

  it("keeps an ordinary bomb ticking while the trolley stays at its station", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles[4 * s.grid.width + 7] = Tile.Empty;
    placePlayerAt(s, "a", 12, 9);
    placePlayerAt(s, "b", 7, 4);
    expect(placeBomb(s, "b")).toBe(true);
    placePlayerAt(s, "b", 12, 8);
    for (let tick = 1; tick <= 49; tick++) step(s);
    expect(s.stageState!.trolley!.riderId).toBeUndefined();
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]!.trolleyContactPending).toBeUndefined();
    expect(s.bombs[0]!.fuse).toBeGreaterThan(0);
  });

  it("keeps the native trolley passenger alive through a bomb blast on the route", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    const trolley = s.stageState!.trolley!;
    trolley.routeRng = 24;
    s.grid.tiles[4 * s.grid.width + 7] = Tile.Empty;
    placePlayerAt(s, "a", 7, 4);
    expect(placeBomb(s, "a")).toBe(true);
    placePlayerAt(s, "a", 7, 7);
    placePlayerAt(s, "b", 7, 5);
    const rider = s.players[1]!;
    for (let tick = 1; tick <= 48; tick++) step(s);
    expect(trolley.riderId).toBe("b");
    expect(s.bombs[0]?.trolleyContactPending).toBe(true);
    expect(rider.alive).toBe(true);
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    for (let tick = 49; tick <= 65; tick++) {
      step(s);
      step(restored);
      expect(rider.alive, `rider in native blast update ${tick}`).toBe(true);
      expect(trolley.riderId).toBe("b");
      expect(s.flames.some(flame => flame.x === 7 && flame.y === 4)).toBe(true);
      expect(restored.players[1]).toEqual(rider);
    }
    expect(s.bombs).toHaveLength(0);
    expect(s.players[0]!.alive).toBe(true);
  });

  it("protects the passenger from a controlled blast during native boarding", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 24;
    s.grid.tiles[4 * s.grid.width + 7] = Tile.Empty;
    placePlayerAt(s, "a", 7, 4);
    expect(placeBomb(s, "a")).toBe(true);
    placePlayerAt(s, "a", 7, 7);
    placePlayerAt(s, "b", 7, 5);
    for (let tick = 1; tick <= 17; tick++) step(s);
    expect(s.stageState!.trolley!.phase).toBe("boarding");
    s.bombs[0]!.fuse = 1;
    for (let tick = 18; tick <= 30; tick++) {
      step(s);
      expect(s.players[1]!.alive, `native boarding explosion update ${tick}`).toBe(true);
      expect(s.stageState!.trolley!.riderId).toBe("b");
      expect(s.flames.some(flame => flame.x === 7 && flame.y === 4)).toBe(true);
    }
    expect(s.players[0]!.alive).toBe(true);
  });

  it("protects the passenger during the native leftward disembark arc", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.stageState!.trolley!.routeRng = 0;
    s.grid.tiles[4 * s.grid.width + 7] = Tile.Empty;
    placePlayerAt(s, "a", 2, 3);
    placePlayerAt(s, "b", 7, 5);
    for (let tick = 1; tick <= 364; tick++) step(s);
    expect(s.stageState!.trolley!.phase).toBe("leaving");
    expect(s.stageState!.trolley!.riderId).toBe("b");
    placePlayerAt(s, "a", 7, 4);
    expect(placeBomb(s, "a")).toBe(true);
    placePlayerAt(s, "a", 2, 3);
    s.bombs[0]!.fuse = 1;
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    for (let tick = 365; tick <= 390; tick++) {
      step(s);
      step(restored);
      expect(s.players[1]!.alive, `native disembark explosion update ${tick}`).toBe(true);
      expect(s.stageState!.trolley!.riderId).toBe("b");
      expect(restored.players[1]).toEqual(s.players[1]);
    }
    expect(s.bombs).toHaveLength(0);
    expect(s.players[0]!.alive).toBe(true);
  });

  it("does not protect a stationary player from the same bomb flame", () => {
    const s = createMatch({ stage: "sb4-11", seed: 17, playerIds: ["a", "b"], blockDensity: 0 });
    s.grid.tiles[4 * s.grid.width + 7] = Tile.Empty;
    placePlayerAt(s, "a", 7, 4);
    expect(placeBomb(s, "a")).toBe(true);
    placePlayerAt(s, "a", 7, 7);
    placePlayerAt(s, "b", 7, 4);
    s.bombs[0]!.fuse = 1;
    step(s);
    expect(s.stageState!.trolley!.riderId).toBeUndefined();
    expect(s.players[1]!.alive).toBe(false);
    expect(s.flames.some(flame => flame.x === 7 && flame.y === 4)).toBe(true);
  });
});
