import { expect, it } from "vitest";
import { createMatch, placeBomb, placePlayerAt, publicView, type Snapshot } from "@bombtop/shared";
import { KickPrediction } from "../src/net/kick-prediction";
import { Predictor } from "../src/net/prediction";

it.each([1, 60])("does not predict a kick with %i stun ticks left", (stun) => {
  const s = createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 });
  const me = s.players[0]!;
  me.canKick = true;
  me.stun = stun;
  placePlayerAt(s, "them", 2, 1);
  placeBomb(s, "them");
  placePlayerAt(s, "them", 13, 11);
  const view = publicView(s);
  const kicks = new KickPrediction();
  kicks.check(view, me, "right", 0);
  expect(kicks.apply(view, 100)).toBe(view);
});

it("keeps pending movement frozen through the last stun tick without changing snapshots", () => {
  const s = createMatch({ seed: 1, playerIds: ["me", "them"], blockDensity: 0 });
  s.players[0]!.stun = 1;
  const snap: Snapshot = { ...publicView(s), acks: {} };
  const before = structuredClone(snap);
  const predictor = new Predictor("me");
  for (let i = 0; i < 12; i++) predictor.step({ dir: "right", alt: "down", bomb: false });
  expect(predictor.predict(snap)).toEqual(snap.players[0]);
  expect(snap).toEqual(before);

  const released = structuredClone(snap);
  released.players[0]!.stun = 0;
  released.acks.me = { seq: 1, ticks: 12 };
  predictor.step({ dir: "right", bomb: false });
  expect(predictor.predict(released)!.px).toBe(released.players[0]!.px + released.players[0]!.speed);
});
