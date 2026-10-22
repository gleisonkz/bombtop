interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const DEBUG_KEY = "bombtop.debug";

/** Debug mode (connection readout + server log): ?debug in the address, or switched on from the menu. */
export function debugOn(search: string, store: Store): boolean {
  return new URLSearchParams(search).has("debug") || store.get(DEBUG_KEY) === "1";
}

/** Flips the menu's debug switch; returns the new state. */
export function toggleDebug(store: Store): boolean {
  const on = store.get(DEBUG_KEY) !== "1";
  store.set(DEBUG_KEY, on ? "1" : "0");
  return on;
}

const LITE_KEY = "bombtop.lite";
/** Lite mode draws at this many pixels per screen pixel (the screen stretches it). */
export const LITE_RESOLUTION = 0.6;
/** Smart TV browsers (Samsung Tizen, LG webOS, others saying so): slow GPUs, weak CPUs. */
const TV_BROWSER = /SMART-TV|SmartTV|Tizen|Web0S|webOS|HbbTV|BRAVIA|NetCast/i;

/**
 * Lite mode (fewer pixels and frames, no backdrop effects) for weak screens: on by itself in a smart TV's browser,
 * ?lite in the address anywhere, and the menu's switch overrides the guess.
 */
export function liteOn(userAgent: string, search: string, store: Store): boolean {
  if (new URLSearchParams(search).has("lite")) return true;
  const set = store.get(LITE_KEY);
  return set === null ? TV_BROWSER.test(userAgent) : set === "1";
}

/** Flips the menu's lite switch; returns the new state. */
export function toggleLite(userAgent: string, store: Store): boolean {
  const on = !liteOn(userAgent, "", store);
  store.set(LITE_KEY, on ? "1" : "0");
  return on;
}

export function versionLabel(version: string): string {
  return `versão ${version.slice(0, 7)}`;
}

/** Drops the PWA's service worker and cached files, then reloads: the latest deploy, for sure. */
export async function freshReload(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await globalThis.caches?.keys()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } finally {
    location.reload();
  }
}
