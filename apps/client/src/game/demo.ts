import { Bot, CHARACTERS, createMatch, matchResult, STAGES, step, TICK_RATE, type MatchState, type PlayerInput, type StageId } from "@bombtop/shared";

/** Bots in a demo match: one per seat, alternating characters. */
const DEMO_BOTS = 4;
/** Ticks the winner stays on screen before the next match. */
export const DEMO_PAUSE = 3 * TICK_RATE;

/** Bots playing each other on this device, match after match, cycling through the stages. */
export class DemoMatch {
  state!: MatchState;
  stage!: StageId;
  /** Set (null on a draw) while the result is shown; undefined while playing. */
  winner: string | null | undefined;
  private bots: Bot[] = [];
  private round = 0;
  private pause = 0;

  constructor(private readonly seed: () => number = () => Math.floor(Math.random() * 2 ** 32)) {
    this.next();
  }

  /** One simulation tick. */
  advance(): void {
    if (this.winner !== undefined) {
      if (--this.pause <= 0) this.next();
      return;
    }
    const inputs: Record<string, PlayerInput> = {};
    for (const bot of this.bots) inputs[bot.id] = bot.input(this.state);
    step(this.state, inputs);
    const result = matchResult(this.state);
    if (result.over) {
      this.winner = result.winnerId;
      this.pause = DEMO_PAUSE;
    }
  }

  private next(): void {
    this.stage = STAGES[this.round++ % STAGES.length]!;
    const ids = Array.from({ length: DEMO_BOTS }, (_, i) => `bot${i + 1}`);
    this.state = createMatch({
      seed: this.seed(),
      playerIds: ids,
      characters: Object.fromEntries(ids.map((id, i) => [id, CHARACTERS[i % CHARACTERS.length]!])),
      stage: this.stage,
    });
    this.bots = ids.map((id) => new Bot(id, "hard"));
    this.winner = undefined;
  }
}
