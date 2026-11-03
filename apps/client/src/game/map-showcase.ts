import { Bot, createMatch, step, TICK_RATE, type MatchState, type PlayerInput, type StageId } from "@bombtop/shared";

/** How long the map guide's match plays before it starts over. */
export const MAP_SHOW_SECONDS = 40;
/** Once one player (or none) is left, it starts over this soon. */
const AFTER_SECONDS = 2;
const CAST = { a: "bomb", b: "thor", c: "pikachu", d: "naruto" } as const;

/** The map guide's preview: four medium bots playing a round on a map, the whole arena in view, over and over. */
export class MapShowcase {
  state!: MatchState;
  /** The arena tiles in view: all of it. */
  window!: { x: number; y: number; width: number; height: number };
  /** Every character in its own colors. */
  readonly colors = new Map<string, number>();
  private bots: Bot[] = [];
  private decided = -1;

  constructor(readonly stage: StageId) {
    this.reset();
  }

  advance(): void {
    const s = this.state;
    if (s.tick >= MAP_SHOW_SECONDS * TICK_RATE || (this.decided >= 0 && s.tick - this.decided >= AFTER_SECONDS * TICK_RATE)) this.reset();
    const inputs: Record<string, PlayerInput> = {};
    for (const bot of this.bots) inputs[bot.id] = bot.input(this.state, false);
    step(this.state, inputs);
    if (this.decided < 0 && this.state.players.filter((p) => p.alive).length <= 1) this.decided = this.state.tick;
  }

  private reset(): void {
    const ids = Object.keys(CAST);
    this.state = createMatch({ seed: 7, playerIds: ids, characters: { ...CAST }, ownColors: ids, stage: this.stage, revenge: false });
    this.window = { x: 0, y: 0, width: this.state.grid.width, height: this.state.grid.height };
    this.bots = ids.map((id, i) => new Bot(id, "medium", undefined, 7 + i));
    this.decided = -1;
  }
}
