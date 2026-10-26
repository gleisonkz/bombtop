import { Client } from "@colyseus/sdk";
import { resultSound } from "../audio/sound";
import { winnerVoice } from "../audio/voices";
import { AdaptiveDelay } from "../net/adaptive-delay";
import { GhostBlasts, GhostPickups, predictBlast } from "../net/own-actions";
import { between } from "../render/sprites";
import { RemoteMotion } from "../render/remote-motion";
import { smoothBombSlides } from "../render/bomb-motion";
import { Standings } from "./standings";
import {
  C2S,
  ROOM_NAME,
  S2C,
  TICK_RATE,
  TILE,
  type BotLevel,
  type BattleMode,
  type ManiacConfig,
  type CharacterId,
  type LobbyInfo,
  type StageRotationEntry,
  type PlayerInput,
  type Player,
  type PublicView,
  type ResultMessage,
  type Snapshot,
  type Patch,
  DeltaReceiver,
} from "@bombtop/shared";
import { Listener, type CueName } from "../audio/cues";
import { actionCues, EchoFilter } from "../audio/local-cues";
import type { CouchSeats } from "../input/couch";
import { GamepadInput } from "../input/gamepad";
import { KeepAwake } from "../net/keep-awake";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../input/keyboard";
import { FixedStep } from "../loop/fixed-step";
import { GhostBombs } from "../net/ghost-bombs";
import type { RoomLink } from "../net/room-link";
import { KickPrediction } from "../net/kick-prediction";
import { Predictor } from "../net/prediction";
import { serverUrl } from "../net/server-url";
import { SnapshotBuffer } from "../net/snapshot-buffer";
import type { LobbyPanel } from "../ui/lobby";
import { debugNet, NetHud, NetStats } from "../ui/net-hud";
import { nameTags } from "../render/name-tags";
import { crumb } from "../net/client-log";
import type { OnlineChoice } from "../ui/menu";
import type { GameMode, ModeContext } from "./mode";

/** World changes are heard when their authoritative snapshot is drawn. */
const WORLD_CUES = new Set<CueName>(["explode", "break", "wall"]);
/** When the winner's cheer plays: after the announcer and the jingle (see the win/lose/draw recipes). */
const WIN_CHEER_MS = 2300;

export const SERVER_URL: string = serverUrl(import.meta.env.VITE_SERVER_URL, location.href);

/**
 * Online match: the server simulates and this client sends input. Other players
 * are drawn from interpolated snapshots; our own player is predicted locally so
 * it answers the controls right away.
 */
export class OnlineGame implements GameMode {
  private readonly inputs = [new KeyboardInput(WASD), new KeyboardInput(ARROWS)];
  private readonly pad = new GamepadInput();
  /** A beat every 50 ms while quiet in a match keeps a phone's Wi-Fi from batching our snapshots. */
  private readonly awake = new KeepAwake(50);
  /** Render delay for snapshots, as short as the connection allows. */
  private readonly delay = new AdaptiveDelay();
  private readonly buffer = new SnapshotBuffer(this.delay.ms);
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private readonly predictor: Predictor;
  private readonly remoteMotion: RemoteMotion;
  private readonly listener = new Listener();
  private readonly worldListener = new Listener();
  /** Connection readout (?debug), with its ping timer. */
  /** How the connection and this screen are doing, reported to the server's log by every player (gaps, stalls). */
  private readonly stats = new NetStats();
  /** The same numbers on screen, with ?debug. */
  private readonly hud = debugNet() ? new NetHud(this.stats) : null;
  private pinger: ReturnType<typeof setInterval> | undefined;
  private readonly echo = new EchoFilter();
  private readonly ghosts: GhostBombs;
  /** Our special's blast and the items we walk onto, shown before the server confirms them. */
  private readonly blastGhosts: GhostBlasts;
  private pickups = new GhostPickups();
  private readonly kicks = new KickPrediction();
  private latest: Snapshot | null = null;
  private latestAt = 0;
  private lobby: LobbyInfo | null = null;
  /** Who went out when, for the results screen. */
  private readonly standings = new Standings();
  private result: ResultMessage | null = null;
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
    if (choice.kind === "watch") return new OnlineGame(await client.joinById(choice.code, { watch: true }), ctx, panel, null, true);
    const room =
      choice.kind === "public"
        ? await client.joinOrCreate(ROOM_NAME, options)
        : choice.kind === "create"
          ? await client.create(ROOM_NAME, { ...options, private: true })
          : await client.joinById(choice.code, options);
    return new OnlineGame(room, ctx, panel);
  }

  /** A match in a room reached some other way (offline: hosted on a phone nearby; `couch`: more controllers here). */
  static over(link: RoomLink, ctx: ModeContext, panel: LobbyPanel, couch: CouchSeats | null = null, report?: (stats: object) => void): OnlineGame {
    const game = new OnlineGame(link, ctx, panel, couch);
    game.report = report ?? null;
    return game;
  }

  /** Where the 5 s connection reports go when the room is not on the server (offline: POST /net). */
  private report: ((stats: object) => void) | null = null;

  private constructor(
    private readonly room: RoomLink,
    private readonly ctx: ModeContext,
    private readonly panel: LobbyPanel,
    /** Other players on this screen, one per extra controller (couch play). */
    private readonly couch: CouchSeats | null = null,
    /** TV mode: this screen only shows the match (no seat, no input). */
    readonly watching = false,
  ) {
    panel.setWatching(watching);
    this.predictor = new Predictor(room.sessionId);
    this.remoteMotion = new RemoteMotion(room.sessionId);
    this.ghosts = new GhostBombs(room.sessionId);
    this.blastGhosts = new GhostBlasts(room.sessionId);
    room.onMessage(S2C.lobby, (info: LobbyInfo) => {
      if (info.phase !== this.lobby?.phase) crumb(`${watching ? "tv" : "sala"} ${info.phase} (${info.members.length})`);
      if (info.phase === "playing" && this.lobby?.phase !== "playing") {
        this.predictor.reset();
        this.remoteMotion.reset();
        this.ghosts.clear();
        this.pickups = new GhostPickups();
        this.kicks.clear();
        this.standings.reset();
        this.result = null;
        ctx.sound.play("start");
      }
      this.lobby = info;
      ctx.renderer.setCharacters(new Map(info.members.map((m) => [m.id, m.character])));
      ctx.renderer.setNames(nameTags(info.members, watching ? null : room.sessionId));
      ctx.renderer.setScore(info.members.map((m) => ({ id: m.id, wins: m.wins })));
      // One player's own screen: a sneaking rival is gone from it (a TV, or several players on one screen, see him faint).
      ctx.renderer.setViewer(watching || couch ? null : room.sessionId);
      panel.update(info, room.sessionId);
      if (info.phase !== "results") ctx.renderer.showBanner("");
      // Shown on the results phase's lobby update, which carries the new win counts.
      else if (this.result) this.showResults(this.result);
    });
    // Whole snapshots now and then; in between, only what changed.
    const snapshots = new DeltaReceiver<Snapshot>();
    room.onMessage(S2C.snapshot, (snap: Snapshot) => this.received(snapshots.full(snap)));
    room.onMessage(S2C.delta, (d: Patch) => {
      const snap = snapshots.delta(d);
      if (snap) this.received(snap);
    });
    room.onMessage(S2C.result, (result: ResultMessage) => {
      this.result = result;
      ctx.sound.play(resultSound(result.winnerId, room.sessionId));
      // The winner's own cheer, once the announcer and jingle are done.
      const cheer = winnerVoice(result.winnerId, this.lobby?.members ?? []);
      if (cheer) setTimeout(() => ctx.sound.play(cheer), WIN_CHEER_MS);
      this.showResults(result);
    });
    room.onLeave(() => {
      if (!this.leaving) ctx.exit("Conexão com a sala encerrada.");
    });
    let n = 0;
    this.pinger = setInterval(() => {
      room.ping((ms) => (this.stats.ping = ms));
      // offline: which way the phones' connection runs
      void room.route?.().then((r) => (this.stats.route = r));
      // Every 5 s of a match the numbers go to the server's log, so nobody has to send screenshots.
      if (++n % 5 === 0 && this.lobby?.phase === "playing") {
        const stats = { ...this.stats.report(navigator.userAgent), ...memoryUse() };
        if (this.report) this.report(stats);
        else room.send(C2S.stats, stats);
      }
    }, 1000);
    // Handlers are attached: ask for the current state (earlier broadcasts were dropped).
    room.send(C2S.sync);
  }

  start(): void {
    this.room.send(C2S.start);
  }

  setWinsToWin(winsToWin: number): void {
    this.room.send(C2S.rules, { winsToWin });
  }

  setTimeMinutes(timeMinutes: 1 | 2 | 3 | 5 | null): void {
    this.room.send(C2S.rules, { timeMinutes });
  }

  setSuddenDeath(suddenDeath: boolean): void {
    this.room.send(C2S.rules, { suddenDeath });
  }

  setBattleMode(battleMode: BattleMode): void {
    this.room.send(C2S.rules, { battleMode });
  }

  setManiac(maniac: ManiacConfig): void {
    this.room.send(C2S.rules, { maniac });
  }

  setStageRotation(stageRotation: StageRotationEntry[]): void {
    this.room.send(C2S.rules, { stageRotation });
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

  pickBotCharacter(id: string, character: CharacterId): void {
    this.room.send(C2S.botCharacter, { id, character });
  }

  frame(deltaMs: number, nowMs: number): void {
    const t = performance.now();
    this.step(deltaMs, nowMs);
    this.stats.work(performance.now() - t);
  }

  /** One frame: inputs for the ticks due, then the screen. */
  private step(deltaMs: number, nowMs: number): void {
    for (let i = this.loop.advance(deltaMs); i > 0; i--) this.sendInput();

    const sample = this.buffer.sample(nowMs);
    if (!sample) return this.hud?.show();
    this.stats.frame(deltaMs, sample.pastMs > 0, this.buffer.delayMs);
    this.hud?.show();
    const world = this.latest!;
    const width = sample.to.grid.width;
    const heard = this.listener.hear(sample.to).filter((c) => !WORLD_CUES.has(c.name));
    this.ctx.sound.cues(this.echo.filter(heard, nowMs), width);
    this.ctx.sound.cues(this.worldListener.hear(world).filter((c) => WORLD_CUES.has(c.name)), width);
    const others = this.remoteMotion.sample(sample, nowMs);
    const prev = new Map(others.players.map((p) => [p.id, { px: p.px, py: p.py }]));
    const { bombs, flames, grid, items, blasts } = world;
    const mixed = { ...others, tick: world.tick, bombs, flames, grid, items, blasts };
    const placed = this.ghosts.apply(mixed, nowMs);
    const kicked = this.kicks.apply(placed, nowMs);
    let view = this.blastGhosts.apply(smoothBombSlides(world, kicked, nowMs - this.latestAt), nowMs);
    const me = this.playing() ? this.predictor.predict(this.latest!) : null;
    if (me) {
      // Walking onto an item takes it (and plays its sound) now, not a round trip later.
      const got = this.pickups.check(view, me, nowMs);
      this.ctx.sound.cues(got, width);
      this.echo.played(got, nowMs);
    }
    view = this.pickups.apply(view, nowMs);
    this.ctx.specialCooldown?.(me?.specialCooldown ?? 0);
    if (!me) {
      this.measureJumps(view, prev, 1, null);
      return this.ctx.renderer.draw(view, prev, 1);
    }
    if (import.meta.env.DEV) Object.assign(window, { __me: me });
    prev.set(me.id, { px: me.px, py: me.py });
    const players = view.players.map((p) => (p.id === me.id ? me : p));
    this.measureJumps({ ...view, players }, prev, 1, me.id);
    this.ctx.renderer.draw({ ...view, players }, prev, 1);
  }

  /** Where each player was drawn last frame, to report teleports. */
  private drawn = new Map<string, { px: number; py: number }>();

  private measureJumps(view: PublicView, prev: Map<string, { px: number; py: number }>, alpha: number, me: string | null): void {
    let mine = 0;
    let others = 0;
    for (const p of view.players) {
      if (!p.alive) continue;
      const at = between(prev.get(p.id) ?? p, p, alpha);
      const was = this.drawn.get(p.id);
      this.drawn.set(p.id, at);
      if (!was) continue;
      const tiles = (Math.abs(at.px - was.px) + Math.abs(at.py - was.py)) / TILE;
      if (p.id === me) mine = Math.max(mine, tiles);
      else others = Math.max(others, tiles);
    }
    this.stats.jumps(mine, others);
  }

  private playing(): boolean {
    return !!this.latest && this.lobby?.phase === "playing";
  }

  /** Sends input only when it changes or a button is pressed; the server keeps the held direction. */
  private sendInput(): void {
    if (this.watching) return;
    this.couch?.tick(this.lobby?.phase ?? null, this.lobby?.members.map((m) => m.character) ?? []);
    const input = mergeInputs([...this.inputs.map((k) => k.sample()), this.pad.sample(), this.ctx.touch.sample()]);
    const actor = (input.bomb || input.action || input.special) && this.playing() ? this.predictor.predict(this.latest!) : null;
    const t = this.predictor.clock;
    const seq = this.predictor.step(input);
    if (actor && seq !== null) this.actNow(input, seq, actor);
    const now = performance.now();
    if (seq !== null) {
      this.room.send(C2S.input, { ...input, seq, t });
      this.awake.sent(now);
    } else if (this.playing() && this.awake.due(now)) {
      this.room.send(C2S.beat);
      this.awake.sent(now);
    }
    // Walking into a bomb kicks it now on our screen, not a round trip later.
    const me = this.playing() ? this.predictor.predict(this.latest!) : null;
    if (me) {
      const at = performance.now();
      if (input.stopKick) this.kicks.stop(me.id, at);
      const kick = input.stopKick ? null : this.kicks.check(this.latest!, me, input.dir, at);
      if (kick) {
        const cue = [{ name: "kick" as const, x: kick.x + 0.5 }];
        this.ctx.sound.cues(cue, this.latest!.grid.width);
        this.echo.played(cue, at);
      }
    }
  }

  /** Our own button press is heard (and a placed bomb drawn) at once; the server's echo is skipped. */
  private actNow(input: PlayerInput, seq: number, me: Player): void {
    const now = performance.now();
    // A blast we already predicted is still recharging on the server's side: don't cast it twice.
    const casting = this.blastGhosts.active(now);
    const shot = (c: { name: string }) => c.name === "web";
    const cues = actionCues(this.ghosts.apply(this.latest!, now), me, input).filter((c) => !shot(c) || !casting);
    for (const c of cues) if (c.name === "place") this.ghosts.add(Math.floor(c.x), Math.floor(me.py / TILE), now, me.bombType, seq);
    const blast = cues.some(shot) ? predictBlast(this.latest!, me) : null;
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

  /** A snapshot arrived (whole or rebuilt from a difference). */
  private received(snap: Snapshot): void {
    if (!this.buffer.latest) this.ctx.fit(snap.grid.width, snap.grid.height);
    const now = performance.now();
    this.latestAt = now;
    this.stats.arrival(now);
    this.delay.observe(now);
    this.buffer.delayMs = this.delay.ms;
    this.buffer.push(snap, now);
    this.latest = snap;
    this.predictor.reconcile(snap);
    this.ghosts.reconcile(snap);
    this.standings.see(snap.players, snap.tick);
    if (import.meta.env.DEV) Object.assign(window, { __snapshot: snap });
  }

  private showResults({ winnerId, setOver }: ResultMessage): void {
    if (!this.lobby) return;
    const ids = this.lobby.members.map((m) => m.id);
    this.panel.showResults(this.standings.ranking(ids, winnerId), this.lobby, this.room.sessionId, winnerId, setOver);
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
    this.couch?.leaveAll();
    await this.room.leave().catch(() => undefined);
    this.ctx.exit();
  }

  dispose(): void {
    clearInterval(this.pinger);
    this.hud?.dispose();
    this.panel.hide();
    this.ctx.renderer.showBanner("");
    this.ctx.renderer.setNames(new Map()); // the menus' scenes go untagged
    this.ctx.renderer.setScore(null);
    this.ctx.specialCooldown?.(0);
    if (!this.leaving) {
      this.leaving = true;
      this.couch?.leaveAll();
      void this.room.leave().catch(() => undefined);
    }
  }
}

/** The page's script memory (MB, Chrome only) and the device's (GB), for the log: a phone near its limit crashes. */
function memoryUse(): { mem?: number; dm?: number } {
  const heap = (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const dm = (navigator as { deviceMemory?: number }).deviceMemory;
  return { ...(heap ? { mem: Math.round(heap / 2 ** 20) } : {}), ...(dm ? { dm } : {}) };
}
