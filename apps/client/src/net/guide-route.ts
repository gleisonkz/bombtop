import type { Address } from "./room-route";

const ROUTE = /^\/itens\/?$/;

/**
 * Keeps the item guide in the address (/itens): the back button closes it,
 * a reload stays on it and the link can be shared.
 */
export class GuideRoute {
  /** We pushed the guide's entry, so closing can step back over it. */
  private pushed = false;

  constructor(private readonly address: Address) {}

  isOpen(): boolean {
    return ROUTE.test(new URL(this.address.href).pathname);
  }

  opened(): void {
    if (this.isOpen()) return;
    const url = new URL(this.address.href);
    url.pathname = "/itens";
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
