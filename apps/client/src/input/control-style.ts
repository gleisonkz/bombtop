/** How touch steering works: a fixed d-pad (default) or a stick that appears wherever the thumb lands. */
export type ControlStyle = "dpad" | "stick";

/** The saved choice (storage value), falling back to the d-pad. */
export function controlStyle(raw: string | null): ControlStyle {
  return raw === "stick" ? "stick" : "dpad";
}

export function otherStyle(style: ControlStyle): ControlStyle {
  return style === "dpad" ? "stick" : "dpad";
}
