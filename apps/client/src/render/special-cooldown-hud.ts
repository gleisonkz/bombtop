import { Container, Text } from "pixi.js";
import type { Player } from "@bombtop/shared";
import { specialCountdown } from "../ui/special-countdown";

/** Lives inside the bottom wall, leaving portraits and the playable floor clear. */
export class SpecialCooldownHud {
  readonly root = new Container();
  private readonly labels = new Map<string, Text>();

  constructor(private readonly lite = false) {}

  update(players: readonly (Player | undefined)[], width: number, height: number): void {
    const ids = new Set(players.flatMap(p => p ? [p.id] : []));
    for (const [id, label] of this.labels) {
      if (ids.has(id)) continue;
      label.destroy();
      this.labels.delete(id);
    }
    players.forEach((player, seat) => {
      if (!player) return;
      let label = this.labels.get(player.id);
      if (!label) {
        label = new Text({ text: "", resolution: this.lite ? 1.5 : 4,
          style: { fontFamily: "Lilita One, sans-serif", fontSize: 5.5, align: "center", lineHeight: 6,
            fill: 0xffffff, stroke: { color: 0x15152a, width: 1.5 } } });
        label.anchor.set(0.5);
        this.labels.set(player.id, label);
        this.root.addChild(label);
      }
      const seconds = specialCountdown(player.specialCooldown);
      const status = player.alive ? (seconds ? `${seconds}s` : "Pronto") : "Fora";
      const text = `J${seat + 1} · ESPECIAL\n${status}`;
      if (label.text !== text) label.text = text;
      label.style.fill = player.alive ? (seconds ? 0xffd23f : 0x82efad) : 0xa5a5b8;
      label.position.set(width * (seat + 0.5) / players.length, height - 8);
    });
    this.root.visible = players.length > 0;
  }
}
