/** Room pages live at /sala/<code>; old invite links carried it as ?sala=<code>. */
const PARAM = "sala";
const ROUTE = /^\/sala\/([^/]+)\/?$/;
/** A TV watching a room (no seat): /tv/<code>. */
const TV_ROUTE = /^\/tv\/([^/]+)\/?$/;
/** A friend's offline (Wi-Fi) room, found through the server: /wifi/<code> (net/lan.ts). */
const WIFI_ROUTE = /^\/wifi\/([A-Za-z0-9]{4,8})\/?$/;
/** Colyseus room ids: short url-safe strings. */
const CODE = /^[A-Za-z0-9_-]{1,32}$/;

/** Link that drops whoever opens it straight into the room. */
export function inviteUrl(pageHref: string, code: string): string {
  const url = new URL(pageHref);
  url.search = "";
  url.hash = "";
  url.pathname = `/${PARAM}/${code}`;
  return url.toString();
}

/** Room code from an invite link, or null when there is none (or it is junk). */
export function codeFromUrl(href: string): string | null {
  const url = new URL(href);
  const code = ROUTE.exec(url.pathname)?.[1] ?? url.searchParams.get(PARAM);
  return code && CODE.test(code) ? code : null;
}

/** Address of a TV watching the room: a reload watches again instead of taking a seat. */
export function tvUrl(pageHref: string, code: string): string {
  const url = new URL(inviteUrl(pageHref, code));
  url.pathname = `/tv/${code}`;
  return url.toString();
}

/** Room code of a TV address, or null. */
export function tvCodeFromUrl(href: string): string | null {
  const code = TV_ROUTE.exec(new URL(href).pathname)?.[1];
  return code && CODE.test(code) ? code : null;
}

/** Link that opens the game on a friend's phone and joins this phone's offline room. */
export function wifiUrl(pageHref: string, code: string): string {
  const url = new URL(inviteUrl(pageHref, code));
  url.pathname = `/wifi/${code}`;
  return url.toString();
}

/** Offline room code of a /wifi/ link, or null. */
export function wifiCodeFromUrl(href: string): string | null {
  return WIFI_ROUTE.exec(new URL(href).pathname)?.[1]?.toUpperCase() ?? null;
}

/** The same address without the room: back to the menu. */
export function withoutInvite(href: string): string {
  const url = new URL(href);
  if (ROUTE.test(url.pathname) || TV_ROUTE.test(url.pathname)) url.pathname = "/";
  url.searchParams.delete(PARAM);
  return url.toString();
}

export function inviteText(url: string): string {
  return `Bora jogar Bombtop! 💣 Entra na minha sala: ${url}`;
}
