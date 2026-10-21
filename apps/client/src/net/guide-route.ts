import type { Address } from "./room-route";

/**
 * Keeps a guide page in the address (/itens, /personagens): the back button closes it,
 * a reload stays on it and the link can be shared.
 */
export class GuideRoute {
  /** We pushed the guide's entry, so closing can step back over it. */
  private pushed = false;
  private readonly route: RegExp;

  constructor(
    private readonly address: Address,
    private readonly path = "/itens",
  ) {
    this.route = new RegExp(`^${path}/?$`);
  }

  isOpen(): boolean {
    return this.route.test(new URL(this.address.href).pathname);
  }

  opened(): void {
    if (this.isOpen()) return;
    const url = new URL(this.address.href);
    url.pathname = this.path;
    this.address.push(url.toString());
    this.pushed = true;
  }

  closed(): void {
    if (!this.isOpen()) return;
    if (this.pushed) this.address.back();
    else {
      const url = new URL(this.address.href);
      url.pathname = "/";
      this.address.replace(url.toString());
    }
    this.pushed = false;
  }
}
