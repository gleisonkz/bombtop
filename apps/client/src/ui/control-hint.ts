import { el } from "./dom";

/** Keyboard legend with the physical layout of a classic PC keyboard. */
export function controlHint(): HTMLElement {
  const key = (text: string, wide = false) => el("kbd", {
    class: wide ? "control-key control-key-wide" : "control-key",
    text,
  });
  const cluster = (labels: string[]) => el("span", { class: "control-key-cluster" }, labels.map((label) => key(label)));
  const hint = el("div", { class: "hint keys-hint" }, [
    el("span", { class: "control-movement" }, [
      cluster(["W", "A", "S", "D"]),
      el("span", { text: "ou" }),
      cluster(["↑", "←", "↓", "→"]),
    ]),
    el("span", { class: "control-binding control-bomb-binding" }, [key("Espaço", true), el("span", { text: "bomba" })]),
    el("span", { class: "control-binding" }, [key("Shift", true), el("span", { text: "ação" })]),
  ]);
  hint.setAttribute("role", "group");
  hint.setAttribute("aria-label", "Controles: WASD ou setas para mover. Espaço: bomba. Shift: ação.");
  for (const child of hint.children) child.setAttribute("aria-hidden", "true");
  return hint;
}
