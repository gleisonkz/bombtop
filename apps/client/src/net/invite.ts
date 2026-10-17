/** Query param that carries the room code in an invite link. */
const PARAM = "sala";
/** Colyseus room ids: short url-safe strings. */
const CODE = /^[A-Za-z0-9_-]{1,32}$/;

/** Link that drops whoever opens it straight into the room. */
export function inviteUrl(pageHref: string, code: string): string {
  const url = new URL(pageHref);
  url.search = "";
  url.hash = "";
  url.searchParams.set(PARAM, code);
  return url.toString();
}

/** Room code from an invite link, or null when there is none (or it is junk). */
export function codeFromUrl(href: string): string | null {
  const code = new URL(href).searchParams.get(PARAM);
  return code && CODE.test(code) ? code : null;
}

/** The same address without the invite, so a reload does not rejoin. */
export function withoutInvite(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(PARAM);
  return url.toString();
}

export function inviteText(url: string): string {
  return `Bora jogar Bombtop! 💣 Entra na minha sala: ${url}`;
}
