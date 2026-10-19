import { Client, type Room } from "@colyseus/sdk";
import { resultSound } from "../audio/sound";
import { AdaptiveDelay } from "../net/adaptive-delay";
import { GhostBlasts, GhostPickups, predictBlast } from "../net/own-actions";
import { aheadOf, MAX_AHEAD } from "../net/world-ahead";
import {
  C2S,
  ROOM_NAME,
  S2C,
  TICK_RATE,
  TILE,
  type BotLevel,
  type CharacterId,
  type LobbyInfo,
  type PlayerInput,
  type PublicView,
  type ResultMessage,
  type Snapshot,
} from "@bombtop/shared";
import { Listener, type CueName } from "../audio/cues";
import { actionCues, EchoFilter } from "../audio/local-cues";
import { GamepadInput } from "../input/gamepad";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../input/keyboard";
import { FixedStep } from "../loop/fixed-step";
import { GhostBombs } from "../net/ghost-bombs";
import { KickPrediction } from "../net/kick-prediction";
import { Predictor } from "../net/prediction";
import { serverUrl } from "../net/server-url";
import { SnapshotBuffer } from "../net/snapshot-buffer";
import type { LobbyPanel } from "../ui/lobby";
import { debugNet, NetHud } from "../ui/net-hud";
import type { OnlineChoice } from "../ui/menu";
import type { GameMode, ModeContext } from "./mode";

/** Sounds of the world ahead: heard when they are drawn, not when the late snapshot shows them. */
const WORLD_CUES = new Set<CueName>(["explode", "break", "wall"]);

export const SERVER_URL: string = serverUrl(import.meta.env.VITE_SERVER_URL, location.href);

/**
 * Online match: the server simulates and this client sends input. Other players
 * are drawn from interpolated snapshots; our own player is predicted locally so
 * it answers the controls right away.
 */
export class OnlineGame implements GameMode {
  private readonly inputs = [new KeyboardInput(WASD), new KeyboardInput(ARROWS)];
  private readonly pad = new GamepadInput();
  /** Render delay for snapshots, as short as the connection allows. */
  private readonly delay = new AdaptiveDelay();
  private readonly buffer = new SnapshotBuffer(this.delay.ms);
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private readonly predictor: Predictor;
  private readonly listener = new Listener();
  /** Hears the world run ahead (explosions, blocks, walls), in step with what is drawn. */
  private readonly worldListener = new Listener();
  /** Tick the world is drawn at: the latest snapshot plus our lead; never goes back. */
  private worldTick = 0;
  private ahead: { from: Snapshot; n: number; view: PublicView } | null = null;
  /** Connection readout (?debug), with its ping timer. */
  private readonly hud = debugNet() ? new NetHud() : null;
  private pinger: ReturnType<typeof setInterval> | undefined;
  private readonly echo = new EchoFilter();
  private readonly ghosts: GhostBombs;
  /** Our ice blast and the items we walk onto, shown before the server confirms them. */
  private readonly blastGhosts: GhostBlasts;
  private pickups = new GhostPickups();
  private readonly kicks = new KickPrediction();
  private latest: Snapshot | null = null;
  private lobby: LobbyInfo | null = null;
  private leaving = false;

  static async connect(
    choice: OnlineChoice,
    who: { name: string; token?: string; character: CharacterId },
    ctx: ModeContext,
    panel: LobbyPanel,
    /** Reconnection token of this tab's old seat in the room being joined (after a reload). */
    seat: string | null = null,
  ): Promise<OnlineGame> {
    const client = new Client(SERVER_URL);
    if (seat && choice.kind === "join") {
      const back = await client.reconnect(seat).catch(() => null);
      if (back) return new OnlineGame(back, ctx, panel);
    }
    const base = { name: who.name, character: who.character };
    const options = who.token ? { ...base, token: who.token } : base;
    const room =
      choice.kind === "public"
        ? await client.joinOrCreate(ROOM_NAME, options)
        : choice.kind === "create"
          ? await client.create(ROOM_NAME, { ...options, private: true })
          : await client.joinById(choice.code, options);
    return new OnlineGame(room, ctx, panel);
  }

  private constructor(
    private readonly room: Room,
    private readonly ctx: ModeContext,
    private readonly panel: LobbyPanel,
  ) {
    this.predictor = new Predictor(room.sessionId);
    this.ghosts = new GhostBombs(room.sessionId);
    this.blastGhosts = new GhostBlasts(room.sessionId);
    room.onMessage(S2C.lobby, (info: LobbyInfo) => {
      if (info.phase === "playing" && this.lobby?.phase !== "playing") {
        this.predictor.reset();
        this.ghosts.clear();
        this.pickups = new GhostPickups();
        this.kicks.clear();
        ctx.sound.play("start");
      }
      this.lobby = info;
      ctx.renderer.setCharacters(new Map(info.members.map((m) => [m.id, m.character])));
      panel.update(info, room.sessionId);
      if (info.phase === "playing") ctx.renderer.showBanner("");
    });
    room.onMessage(S2C.snapshot, (snap: Snapshot) => {
      if (!this.buffer.latest) ctx.fit(snap.grid.width, snap.grid.height);
      const now = performance.now();
      this.delay.observe(now);
      this.buffer.delayMs = this.delay.ms;
      this.buffer.push(snap, now);
      this.latest = snap;
      if (import.meta.env.DEV) Object.assign(window, { __snapshot: snap });
    });
    room.onMessage(S2C.result, (result: ResultMessage) => {
      const winner = this.lobby?.members.find((m) => m.id === result.winnerId);
      const you = result.winnerId === room.sessionId;
      ctx.sound.play(resultSound(result.winnerId, room.sessionId));
      ctx.renderer.showBanner(you ? "Você venceu!" : winner ? `${winner.name} venceu!` : "Empate!");
    });
    room.onLeave(() => {
      if (!this.leaving) ctx.exit("Conexão com a sala encerrada.");
    });
    const hud = this.hud;
    if (hud) this.pinger = setInterval(() => room.ping((ms) => (hud.stats.ping = ms)), 1000);
    // Handlers are attached: ask for the current state (earlier broadcasts were dropped).
    room.send(C2S.sync);
  }

  start(): void {
    this.room.send(C2S.start);
  }

  addBot(level: BotLevel): void {
    this.room.send(C2S.addBot, { level });
  }

  removeBot(id: string): void {
    this.room.send(C2S.removeBot, { id });
  }

  pickCharacter(character: CharacterId): void {
    this.room.send(C2S.character, { character });
  }

  frame(deltaMs: number, nowMs: number): void {
    for (let i = this.loop.advance(deltaMs); i > 0; i--) this.sendInput();

    const sample = this.buffer.sample(nowMs);
    if (!sample) return this.hud?.show();
    if (this.hud) {
      this.hud.stats.frame(deltaMs, sample.alpha > 1, this.buffer.delayMs);
      this.hud.show();
    }
    const world = this.world();
    const width = sample.to.grid.width;
    const heard = this.listener.hear(sample.to).filter((c) => !WORLD_CUES.has(c.name));
    this.ctx.sound.cues(this.echo.filter(heard, nowMs), width);
    this.ctx.sound.cues(this.worldListener.hear(world).filter((c) => WORLD_CUES.has(c.name)), width);
    const prev = new Map(sample.from.players.map((p) => [p.id, { px: p.px, py: p.py }]));
    // Other players come from the (past) sample; bombs, flames and the arena from the world ahead.
    const { bombs, flames, grid, items, blasts } = world;
    const mixed = { ...sample.to, bombs, flames, grid, items, blasts };
    let view = this.blastGhosts.apply(this.kicks.apply(this.ghosts.apply(mixed, nowMs), nowMs), nowMs);
    const me = this.playing() ? this.predictor.predict(this.latest!) : null;
    if (me) {
      // Walking onto an item takes it (and plays its sound) now, not a round trip later.
      const got = this.pickups.check(view, me, nowMs);
      this.ctx.sound.cues(got, width);
      this.echo.played(got, nowMs);
    }
    view = this.pickups.apply(view, nowMs);
    if (!me) return this.ctx.renderer.draw(view, prev, sample.alpha);
    if (import.meta.env.DEV) Object.assign(window, { __me: me });
    prev.set(me.id, { px: me.px, py: me.py });
    const players = view.players.map((p) => (p.id === me.id ? me : p));
    this.ctx.renderer.draw({ ...view, players }, prev, sample.alpha);
  }

  /**
   * The latest snapshot run forward to the time our predicted player lives in,
   * so a bomb blows on our screen when it really does, not a round trip later.
   */
  private world(): PublicView {
    const latest = this.latest!;
    if (latest.tick < this.worldTick - MAX_AHEAD * 2) this.worldTick = 0; // new match
    const lead = this.playing() ? this.predictor.lead(latest) : 0;
    this.worldTick = Math.min(latest.tick + MAX_AHEAD, Math.max(this.worldTick, latest.tick + lead));
    const n = this.worldTick - latest.tick;
    if (this.ahead?.from !== latest || this.ahead.n !== n) this.ahead = { from: latest, n, view: aheadOf(latest, n) };
    return this.ahead.view;
  }

  private playing(): boolean {
    return !!this.latest && this.lobby?.phase === "playing";
  }

  /** Sends input only when it changes or a button is pressed; the server keeps the held direction. */
  private sendInput(): void {
    const input = mergeInputs([...this.inputs.map((k) => k.sample()), this.pad.sample(), this.ctx.touch.sample()]);
    if ((input.bomb || input.action || input.special) && this.playing()) this.actNow(input);
    const t = this.predictor.clock;
    const seq = this.predictor.step(input);
    if (seq !== null) this.room.send(C2S.input, { ...input, seq, t });
    // Walking into a bomb kicks it now on our screen, not a round trip later.
    const me = this.playing() ? this.predictor.predict(this.latest!) : null;
    if (me) this.kicks.check(this.latest!, me, input.dir, performance.now());
  }

  /** Our own button press is heard (and a placed bomb drawn) at once; the server's echo is skipped. */
  private actNow(input: PlayerInput): void {
    const me = this.predictor.predict(this.latest!);
    if (!me) return;
    const now = performance.now();
    // A blast we already predicted is still recharging on the server's side: don't cast it twice.
    const casting = this.blastGhosts.active(now);
    const cues = actionCues(this.latest!, me, input).filter((c) => c.name !== "ice" || !casting);
    for (const c of cues) if (c.name === "place") this.ghosts.add(Math.floor(c.x), Math.floor(me.py / TILE), now);
    const blast = cues.some((c) => c.name === "ice") ? predictBlast(this.latest!, me) : null;
    if (blast) this.blastGhosts.add(blast, now);
    this.ctx.sound.cues(cues, this.latest!.grid.width);
    this.echo.played(cues, now);
  }

  keyDown(code: string): boolean {
    if (code === "Escape") {
      void this.leave();
      return true;
    }
    return this.inputs.map((k) => k.keyDown(code)).some(Boolean);
  }

  keyUp(code: string): void {
    for (const k of this.inputs) k.keyUp(code);
  }

  blur(): void {
    for (const k of this.inputs) k.reset();
  }

  /** Token to take this seat back after a reload. */
  get seatToken(): string {
    return this.room.reconnectionToken;
  }

  /** The room's code, as typed to join it and shown in invite links. */
  get code(): string {
    return this.room.roomId;
  }

  async leave(): Promise<void> {
    this.leaving = true;
    await this.room.leave().catch(() => undefined);
    this.ctx.exit();
  }

  dispose(): void {
    clearInterval(this.pinger);
    this.hud?.dispose();
    this.panel.hide();
    this.ctx.renderer.showBanner("");
    if (!this.leaving) {
      this.leaving = true;
      void this.room.leave().catch(() => undefined);
    }
  }
}
