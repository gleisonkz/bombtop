import { codeFromUrl, inviteUrl, tvCodeFromUrl, tvUrl, withoutInvite } from "./invite";

/** The page address and its history (window.location + history in the browser). */
export interface Address {
  readonly href: string;
  push(url: string): void;
  replace(url: string): void;
  /** Steps back one history entry (the back button). */
  back(): void;
}

/**
 * Keeps the room in the address while the player is in it (/sala/CODE): the address
 * bar is the invite link, a reload rejoins and the back button leaves.
 */
export class RoomRoute {
  private code: string | null = null;

  constructor(private readonly address: Address) {}

  /** `tv`: watching it, at /tv/CODE (a reload watches again). */
  entered(code: string, tv = false): void {
    this.code = code;
    if (this.inAddress() !== code) this.address.push((tv ? tvUrl : inviteUrl)(this.address.href, code));
  }

  left(): void {
    this.code = null;
    if (this.inAddress()) this.address.replace(withoutInvite(this.address.href));
  }

  /** In a room, but the address moved off it (back button). */
  wentBack(): boolean {
    return this.code !== null && this.inAddress() !== this.code;
  }

  private inAddress(): string | null {
    return codeFromUrl(this.address.href) ?? tvCodeFromUrl(this.address.href);
  }
}

export const browserAddress: Address = {
  get href() {
    return location.href;
  },
  push: (url) => history.pushState(null, "", url),
  replace: (url) => history.replaceState(null, "", url),
  back: () => history.back(),
};
