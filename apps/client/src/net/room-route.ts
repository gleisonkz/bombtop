import { codeFromUrl, inviteUrl, withoutInvite } from "./invite";

/** The page address and its history (window.location + history in the browser). */
export interface Address {
  readonly href: string;
  push(url: string): void;
  replace(url: string): void;
}

/**
 * Keeps the room in the address while the player is in it (/sala/CODE): the address
 * bar is the invite link, a reload rejoins and the back button leaves.
 */
export class RoomRoute {
  private code: string | null = null;

  constructor(private readonly address: Address) {}

  entered(code: string): void {
    this.code = code;
    if (codeFromUrl(this.address.href) !== code) this.address.push(inviteUrl(this.address.href, code));
  }

  left(): void {
    this.code = null;
    if (codeFromUrl(this.address.href)) this.address.replace(withoutInvite(this.address.href));
  }

  /** In a room, but the address moved off it (back button). */
  wentBack(): boolean {
    return this.code !== null && codeFromUrl(this.address.href) !== this.code;
  }
}

export const browserAddress: Address = {
  get href() {
    return location.href;
  },
  push: (url) => history.pushState(null, "", url),
  replace: (url) => history.replaceState(null, "", url),
};
