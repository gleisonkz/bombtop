import type { Item, PublicView } from "@bombtop/shared";

export type PresentedItem = Item & { airborne: boolean };
type Scene = Pick<PublicView, "items" | "stage" | "stageState">;

/** Coordenadas nativas ja incluem o arco; nao acrescentar outra elevacao visual. */
export function presentedItems(scene: Scene): PresentedItem[] {
  const items: PresentedItem[] = scene.items.map(item => ({ ...item, airborne: false }));
  if (scene.stage !== "sb2-12") return items;
  for (const item of scene.stageState?.sb2?.stage12AirItems ?? []) {
    items.push({ kind: item.kind, owner: item.ownerId, airborne: true,
      x: item.motion.flight.x / 16 - 1, y: item.motion.flight.y / 16 - 2 });
  }
  return items;
}
