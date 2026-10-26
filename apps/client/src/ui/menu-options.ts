import { backButton, button, el } from "./dom";

/** Secondary home actions, kept outside the matchmaking card. */
export function menuOptions(actions: HTMLElement[]) {
  const panel = el("div", { class: "menu-options-panel card" });
  panel.id = "home-mode-options";
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };
  const dismiss = () => {
    close();
    toggle.focus({ preventScroll: true });
  };
  const toggle = button("Modos e opções", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  }, "ghost menu-options-toggle");
  toggle.setAttribute("aria-controls", panel.id);
  panel.append(...actions, backButton("Fechar", dismiss, "ghost"));
  const root = el("aside", { class: "menu-options" }, [toggle, panel]);
  root.setAttribute("aria-label", "Modos e opções de jogo");
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  });
  close();
  return { root, close };
}
