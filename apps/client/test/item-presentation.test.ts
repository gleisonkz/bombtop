import { expect, it } from "vitest";
import { ItemKind, SB4_STAGES } from "@bombtop/shared";
import { presentedItems } from "../src/render/item-presentation";

type Scene = Parameters<typeof presentedItems>[0];
function air(kind: ItemKind, x: number, y: number) {
  return { ownerId: "p1", kind, bornFrame: 1, motion: { path: 0xc5c7bc, direction: 2 as const, landed: false,
    flight: { x, y, vx: 0, vy: 0, command: 0, ended: false } } };
}
function scene(): Scene {
  return { stage: "sb2-12", items: [{ kind: ItemKind.Fire, x: 1, y: 1 }],
    stageState: { sb2: { counterOffset: 0, pendingInputs: {},
      stage12AirItems: [air(ItemKind.Fire, 128, 112)] } } };
}

it("apresenta o Fire expelido no ponto nativo da cabeca,sem alterar o estado", () => {
  const view = scene();
  const before = structuredClone(view);
  expect(presentedItems(view)).toEqual([
    { kind: ItemKind.Fire, x: 1, y: 1, airborne: false },
    { kind: ItemKind.Fire, owner: "p1", x: 7, y: 5, airborne: true },
  ]);
  expect(view).toEqual(before);
});

it("mantem tres sprites,fracoes e pontos de borda sem acrescentar outro arco", () => {
  const view = scene();
  view.items = [];
  view.stageState!.sb2!.stage12AirItems = [air(ItemKind.Speed, 144, 227),
    air(ItemKind.Bomb, 0, 129), air(ItemKind.Kick, 132, 107)];
  expect(presentedItems(view).map(item => ({ kind: item.kind, airborne: item.airborne,
    x: (item.x + 0.5) * 16, y: (item.y + 0.5) * 16 }))).toEqual([
    { kind: ItemKind.Speed, airborne: true, x: 136, y: 203 },
    { kind: ItemKind.Bomb, airborne: true, x: -8, y: 105 },
    { kind: ItemKind.Kick, airborne: true, x: 124, y: 83 },
  ]);
});

it("depois do pouso desenha somente o item do chao", () => {
  const view = scene();
  view.stageState!.sb2!.stage12AirItems = [];
  view.items = [{ kind: ItemKind.Fire, x: 7, y: 6 }];
  expect(presentedItems(view)).toEqual([{ kind: ItemKind.Fire, x: 7, y: 6, airborne: false }]);
});

it.each(SB4_STAGES)("preserva a apresentacao dos itens do SB4 em %s", stage => {
  const view = scene();
  view.stage = stage;
  expect(presentedItems(view)).toEqual([{ kind: ItemKind.Fire, x: 1, y: 1, airborne: false }]);
});
