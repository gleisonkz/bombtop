/**
 * Game server address. `configured` is VITE_SERVER_URL: empty means the game port on
 * the page host; a path like "/colyseus" is resolved against the page origin (dev proxy).
 */
export function serverUrl(configured: string | undefined, pageHref: string): string {
  const page = new URL(pageHref);
  if (!configured) return `${page.protocol}//${page.hostname}:2567`;
  return new URL(configured, page.origin).toString().replace(/\/$/, "");
}
