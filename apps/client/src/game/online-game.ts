import { Client, type Room } from "@colyseus/sdk";
import {
  C2S,
  ROOM_NAME,
  S2C,
  TICK_RATE,
  type LobbyInfo,
  type PlayerInput,
  type PublicView,
  type ResultMessage,
} from "@bombtop/shared";
import { GamepadInput } from "../input/gamepad";
import { ARROWS, KeyboardInput, mergeInputs, WASD } from "../input/keyboard";
import { FixedStep } from "../loop/fixed-step";
import { SnapshotBuffer } from "../net/snapshot-buffer";
import type { LobbyPanel } from "../ui/lobby";
import type { OnlineChoice } from "../ui/menu";
import type { GameMode, ModeContext } from "./mode";

/** Render this far in the past so two snapshots (30 Hz) usually bracket the frame. */
const INTERP_DELAY_MS = 100;

export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ?? `${location.protocol === "https:" ? "https" : "http"}://${location.hostname}:2567`;

/** Online match: the server simulates, this client sends input and renders snapshots. */
export class OnlineGame implements GameMode {
  private readonly inputs = [new KeyboardInput(WASD), new KeyboardInput(ARROWS)];
  private readonly pad = new GamepadInput();
  private readonly buffer = new SnapshotBuffer(INTERP_DELAY_MS);
  private readonly loop = new FixedStep(1000 / TICK_RATE);
  private lastSent: PlayerInput = { dir: null, bomb: false, action: false };
  private lobby: LobbyInfo | null = null;
  private leaving = false;

  static async connect(
    choice: OnlineChoice,
    who: { name: string; token?: string },
    ctx: ModeContext,
    panel: LobbyPanel,
  ): Promise<OnlineGame> {
    const client = new Client(SERVER_URL);
    const options = who.token ? { name: who.name, token: who.token } : { name: who.name };
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
    room.onMessage(S2C.lobby, (info: LobbyInfo) => {
      this.lobby = info;
      panel.update(info, room.sessionId);
      if (info.phase === "playing") ctx.renderer.showBanner("");
    });
    room.onMessage(S2C.snapshot, (snap: PublicView) => {
      if (!this.buffer.latest) ctx.fit(snap.grid.width, snap.grid.height);
      this.buffer.push(snap, performance.now());
      if (import.meta.env.DEV) Object.assign(window, { __snapshot: snap });
    });
    room.onMessage(S2C.result, (result: ResultMessage) => {
      const winner = this.lobby?.members.find((m) => m.id === result.winnerId);
      const you = result.winnerId === room.sessionId;
      ctx.renderer.showBanner(you ? "Você venceu!" : winner ? `${winner.name} venceu!` : "Empate!");
    });
    room.onLeave(() => {
      if (!this.leaving) ctx.exit("Conexão com a sala encerrada.");
    });
    // Handlers are attached: ask for the current state (earlier broadcasts were dropped).
    room.send(C2S.sync);
  }

  start(): void {
    this.room.send(C2S.start);
  }

  frame(deltaMs: number, nowMs: number): void {
    for (let i = this.loop.advance(deltaMs); i > 0; i--) this.sendInput();

    const sample = this.buffer.sample(nowMs);
    if (!sample) return;
    const prev = new Map(sample.from.players.map((p) => [p.id, { px: p.px, py: p.py }]));
    this.ctx.renderer.draw(sample.to, prev, sample.alpha);
  }

  /** Sends input only when it changes or a button is pressed; the server keeps the held direction. */
  private sendInput(): void {
    const input = mergeInputs([...this.inputs.map((k) => k.sample()), this.pad.sample(), this.ctx.touch.sample()]);
    if (input.dir === this.lastSent.dir && !input.bomb && !input.action) return;
    this.room.send(C2S.input, input);
    this.lastSent = input;
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

  async leave(): Promise<void> {
    this.leaving = true;
    await this.room.leave().catch(() => undefined);
    this.ctx.exit();
  }

  dispose(): void {
    this.panel.hide();
    this.ctx.renderer.showBanner("");
    if (!this.leaving) {
      this.leaving = true;
      void this.room.leave().catch(() => undefined);
    }
  }
}
