/** Tiny DOM builder. Text always goes through textContent (player names are untrusted). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; title?: string } = {},
  children: (Node | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.title) node.title = props.title;
  for (const c of children) if (c) node.appendChild(c);
  return node;
}

export function button(text: string, onClick: () => void, cls = ""): HTMLButtonElement {
  const b = el("button", { class: cls, text });
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** A screen's way back: also what B presses on a controller (`PadMenus`). */
export function backButton(text: string, onClick: () => void, cls = ""): HTMLButtonElement {
  const b = button(text, onClick, cls);
  b.dataset.padBack = "";
  return b;
}

/** localStorage that never throws (private mode, blocked storage). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
