/**
 * Snapshot deltas: what changed between two plain JSON-like values, and how to
 * rebuild the second from the first. A patch maps each changed key (or index,
 * for lists that kept their length) to `[value]` (replace), `[]` (delete) or a
 * nested patch. Lists that grew or shrank are replaced whole.
 */
export type Patch = { [key: string]: Patch | [unknown] | [] };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function change(a: unknown, b: unknown): Patch | [unknown] | undefined {
  if (a === b) return undefined;
  if ((isObj(a) && isObj(b)) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length)) {
    const p = diff(a as Obj, b as Obj);
    return Object.keys(p).length ? p : undefined;
  }
  return [b];
}

/** The patch that turns `a` into `b` (both objects, or lists of the same length). */
export function diff(a: object, b: object): Patch {
  const from = a as Obj;
  const to = b as Obj;
  const p: Patch = {};
  for (const k of Object.keys(to)) {
    if (to[k] === undefined) continue;
    const c = from[k] === undefined ? ([to[k]] as [unknown]) : change(from[k], to[k]);
    if (c) p[k] = c;
  }
  for (const k of Object.keys(from)) if (from[k] !== undefined && to[k] === undefined) p[k] = [];
  return p;
}

function apply(target: Obj, p: Patch): void {
  for (const [k, c] of Object.entries(p)) {
    if (Array.isArray(c)) {
      if (c.length) target[k] = c[0];
      else delete target[k];
    } else apply(target[k] as Obj, c);
  }
}

/** `base` with `p` applied, as a new value (`base` is left as it was). */
export function patch<T extends object>(base: T, p: Patch): T {
  const out = structuredClone(base);
  apply(out as Obj, p);
  return out;
}

/** Client side of a snapshot stream: the whole snapshot now and then, differences in between. */
export class DeltaReceiver<T extends object> {
  private base: T | null = null;

  full(snap: T): T {
    return (this.base = snap);
  }

  /** The next snapshot, or null while there is no whole one to apply the difference to. */
  delta(p: Patch): T | null {
    return this.base ? (this.base = patch(this.base, p)) : null;
  }
}
