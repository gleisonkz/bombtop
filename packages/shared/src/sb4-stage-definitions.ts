import { ItemKind } from "./state";

export const SB4_STAGE_ITEM_KINDS = [
  ItemKind.Bomb,
  ItemKind.Fire,
  ItemKind.FullFire,
  ItemKind.Speed,
  ItemKind.Egg,
  ItemKind.Glove,
  ItemKind.Punch,
  "push",
  ItemKind.Kick,
  ItemKind.Skull,
  "honey",
] as const;

export type Sb4StageItemKind = (typeof SB4_STAGE_ITEM_KINDS)[number];
export type Sb4StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type Sb4StageItemCounts = Readonly<Record<Sb4StageItemKind, number>>;

interface Sb4StageBase {
  readonly number: Sb4StageNumber;
  readonly name: string;
}

export interface Sb4DocumentedStageDefinition extends Sb4StageBase {
  readonly kind: "documented";
  readonly itemCounts: Sb4StageItemCounts;
  readonly knownTotal: number;
}

export interface Sb4SpecialStageDefinition extends Sb4StageBase {
  readonly kind: "special";
  readonly variant: "unreported" | "roulette";
  readonly itemCounts: null;
  readonly knownTotal: null;
}

export type Sb4StageDefinition = Sb4DocumentedStageDefinition | Sb4SpecialStageDefinition;

export const SB4_STAGE_SOURCE = {
  code: "O",
  evidence: "player-observation",
  url: "https://game.bad-person.net/gamenote/superbom4/superbom4_item_battle.html",
  conditions: {
    humanPlayers: 5,
    com: "normal",
    battle: 3,
    time: "infinite",
    otherOptions: "off",
  },
} as const;

export const SB4_STAGE_DEFINITIONS = [
  {
    number: 1,
    name: "Usual",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 8,
      [ItemKind.Fire]: 5,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 3,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 2,
      [ItemKind.Punch]: 2,
      push: 2,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 28,
  },
  {
    number: 2,
    name: "Fast 'n Slow",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 6,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 2,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 3,
      [ItemKind.Punch]: 0,
      push: 2,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 29,
  },
  {
    number: 3,
    name: "Rolling Sugedama",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 5,
      [ItemKind.FullFire]: 1,
      [ItemKind.Speed]: 5,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 2,
      [ItemKind.Punch]: 2,
      push: 3,
      [ItemKind.Kick]: 2,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 33,
  },
  {
    number: 4,
    name: "Push and Fall",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 6,
      [ItemKind.Fire]: 5,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 3,
      [ItemKind.Egg]: 0,
      [ItemKind.Glove]: 3,
      [ItemKind.Punch]: 2,
      push: 5,
      [ItemKind.Kick]: 2,
      [ItemKind.Skull]: 0,
      honey: 0,
    },
    knownTotal: 26,
  },
  {
    number: 5,
    name: "Numb Bomb",
    kind: "special",
    variant: "unreported",
    itemCounts: null,
    knownTotal: null,
  },
  {
    number: 6,
    name: "Surprise Floor",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 6,
      [ItemKind.FullFire]: 1,
      [ItemKind.Speed]: 3,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 2,
      [ItemKind.Punch]: 2,
      push: 2,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 32,
  },
  {
    number: 7,
    name: "Hide and Blow Seek",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 6,
      [ItemKind.FullFire]: 1,
      [ItemKind.Speed]: 4,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 0,
      [ItemKind.Punch]: 1,
      push: 3,
      [ItemKind.Kick]: 5,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 33,
  },
  {
    number: 8,
    name: "Spinny Slots",
    kind: "special",
    variant: "roulette",
    itemCounts: null,
    knownTotal: null,
  },
  {
    number: 9,
    name: "Seesaw",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 6,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 3,
      [ItemKind.Egg]: 0,
      [ItemKind.Glove]: 3,
      [ItemKind.Punch]: 3,
      push: 3,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 32,
  },
  {
    number: 10,
    name: "Costume/Cosplay",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 6,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 5,
      [ItemKind.Egg]: 0,
      [ItemKind.Glove]: 0,
      [ItemKind.Punch]: 0,
      push: 0,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 8,
    },
    knownTotal: 33,
  },
  {
    number: 11,
    name: "Trolley",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 6,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 3,
      [ItemKind.Egg]: 2,
      [ItemKind.Glove]: 3,
      [ItemKind.Punch]: 2,
      push: 3,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 33,
  },
  {
    number: 12,
    name: "Flag Tag",
    kind: "documented",
    itemCounts: {
      [ItemKind.Bomb]: 10,
      [ItemKind.Fire]: 7,
      [ItemKind.FullFire]: 0,
      [ItemKind.Speed]: 6,
      [ItemKind.Egg]: 0,
      [ItemKind.Glove]: 0,
      [ItemKind.Punch]: 0,
      push: 0,
      [ItemKind.Kick]: 3,
      [ItemKind.Skull]: 1,
      honey: 0,
    },
    knownTotal: 27,
  },
] as const satisfies readonly Sb4StageDefinition[];
