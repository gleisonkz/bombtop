import { CHARACTERS, type CharacterId } from "@bombtop/shared";
import { CHARACTER_SHEETS, previewPose } from "./sheet-art";
import animationBounds from "./cast-animation-bounds.json";

export const CAST_BODY_HEIGHT: Record<Exclude<CharacterId, "bomb">, number> = {
  captain: 124, thor: 127, goku: 142, naruto: 109, spider: 122, pikachu: 150,
  static: CHARACTER_SHEETS.static.lobby!.bodyH!, flash: 158, bugs: 153, lantern: 146, donatello: 130, penelope: 148,
  panther: 141, harry: 157, optimus: 165, pele: 125, lula: 166,
};

/** Complete visible envelope, verified against every frame of each menu animation. */
export const CAST_HORIZONTAL_BOUNDS = animationBounds as Record<Exclude<CharacterId, "bomb">, [number, number]>;

/** Keep the standing bodies close; travelling effects can cross the gaps between companions. */
const BODY_SPACING: Partial<Record<CharacterId, readonly [number, number]>> = {
  harry: [58, 175], optimus: [92, 229],
};

export interface CastArt {
  id: CharacterId;
  side: "left" | "right";
  frameW: number;
  frameH: number;
  anchorX: number;
  anchorY: number;
  bodyH: number;
  horizontalBounds?: readonly [number, number] | undefined;
}

const PRIORITY: readonly CharacterId[] = ["goku", "captain", "naruto", "thor", "static", "pikachu", "flash", "spider", "lantern", "bugs", "pele", "donatello", "harry", "panther", "penelope", "optimus", "lula"];

function slotWidth(item: CastArt): number {
  const [left, right] = spacingBounds(item);
  return right - left;
}

function spacingBounds(item: CastArt): readonly [number, number] {
  return BODY_SPACING[item.id] ?? item.horizontalBounds ?? [0, item.frameW];
}

function edgeSpace(wing: readonly CastArt[]) {
  const first = wing[0];
  const last = wing.at(-1);
  const start = first ? Math.max(0, spacingBounds(first)[0] - (first.horizontalBounds?.[0] ?? 0)) / first.bodyH : 0;
  const end = last ? Math.max(0, (last.horizontalBounds?.[1] ?? last.frameW) - spacingBounds(last)[1]) / last.bodyH : 0;
  return { start, end };
}

function wingLimit(art: readonly CastArt[], side: CastArt["side"], space: number, gap: number): number {
  const wing = art.filter((item) => item.side === side);
  const edges = edgeSpace(wing);
  const units = wing.reduce((sum, item) => sum + slotWidth(item) / item.bodyH, edges.start + edges.end);
  return units === 0 ? Infinity : Math.max(0, space - gap * (wing.length - 1)) / units;
}

export function castLayout({ art, width, heroWidth, heroHeight, maxBodyHeight, minBodyHeight = 64, rotation = 0 }: {
  art: readonly CastArt[]; width: number; heroWidth: number; heroHeight: number; maxBodyHeight: number; minBodyHeight?: number; rotation?: number;
}) {
  const gap = Math.min(4, Math.max(0, (width - heroWidth) / (art.length * 4)));
  const space = Math.max(0, (width - heroWidth) / 2 - gap);
  const available = new Map(art.map((item) => [item.id, item]));
  const selected: CastArt[] = [];
  const order = [...PRIORITY.slice(rotation % PRIORITY.length), ...PRIORITY.slice(0, rotation % PRIORITY.length)];
  for (const id of order) {
    const item = available.get(id);
    if (!item) continue;
    const candidate = art.filter((entry) => entry === item || selected.includes(entry));
    const limit = Math.min(wingLimit(candidate, "left", space, gap), wingLimit(candidate, "right", space, gap));
    if (limit > 0 && (selected.length === 0 || limit >= minBodyHeight)) selected.push(item);
  }
  const ordered = art.filter((item) => selected.includes(item));
  const bodyHeight = selected.length === 0 ? 0 : Math.min(maxBodyHeight, wingLimit(ordered, "left", space, gap), wingLimit(ordered, "right", space, gap));
  const members = ordered.map((item) => ({
    id: item.id,
    scale: bodyHeight / item.bodyH,
    width: slotWidth(item) * bodyHeight / item.bodyH,
    anchorOffset: (item.anchorX - spacingBounds(item)[0]) * bodyHeight / item.bodyH,
  }));
  // Reserve the full roster's envelope so rotation never moves the title or menu below it.
  const height = Math.max(heroHeight, ...art.map((item) => item.anchorY * maxBodyHeight / item.bodyH));
  const footroom = Math.max(0, ...art.map((item) => (item.frameH - item.anchorY) * maxBodyHeight / item.bodyH));
  const wings = { left: edgeSpace(ordered.filter((item) => item.side === "left")), right: edgeSpace(ordered.filter((item) => item.side === "right")) };
  return { bodyHeight, gap, members, height, footroom, wings };
}

export function observeCast(lineup: HTMLElement): () => void {
  let rotation = 0;
  let rotating = false;
  const fit = () => {
    if (lineup.clientWidth === 0) return;
    const elements = new Map<CharacterId, HTMLElement>();
    const art: CastArt[] = [];
    for (const element of lineup.querySelectorAll<HTMLElement>(".cast-member:not(.star)")) {
      const id = CHARACTERS.find((character) => element.querySelector(`.mascot.${character}`));
      if (!id || id === "bomb") continue;
      const source = CHARACTER_SHEETS[id];
      const sheet = previewPose(source, "walk").sheet ?? source;
      art.push({ id, side: element.closest(".cast-wing.left") ? "left" : "right", frameW: sheet.frameW, frameH: sheet.frameH, anchorX: sheet.anchorX, anchorY: sheet.anchorY, bodyH: CAST_BODY_HEIGHT[id], horizontalBounds: CAST_HORIZONTAL_BOUNDS[id] });
      elements.set(id, element);
    }
    const bomba = lineup.querySelector<HTMLElement>(".title-bomber")!;
    const cell = Number.parseFloat(getComputedStyle(bomba).getPropertyValue("--fly-cell"));
    const heroWidth = Math.ceil(Math.max(bomba.offsetWidth, cell) * 1.06 + 8);
    const compact = window.matchMedia("(orientation: portrait) and (max-height: 740px), (orientation: landscape) and (max-height: 500px)").matches;
    const params = { art, width: lineup.clientWidth, heroWidth, heroHeight: bomba.offsetHeight, maxBodyHeight: compact ? 76 : 104, minBodyHeight: compact ? 58 : 70 };
    const baseline = castLayout(params);
    rotating = baseline.members.length < art.length;
    if (!rotating) rotation = 0;
    const layout = rotating && rotation > 0 ? castLayout({ ...params, rotation }) : baseline;
    lineup.style.setProperty("--cast-hero-width", `${heroWidth}px`);
    lineup.style.setProperty("--cast-gap", `${layout.gap}px`);
    lineup.style.setProperty("--cast-height", `${layout.height}px`);
    lineup.style.setProperty("--cast-footroom", `${layout.footroom}px`);
    lineup.style.setProperty("--cast-shadow-width", `${layout.bodyHeight * 0.8}px`);
    for (const side of ["left", "right"] as const) {
      const wing = lineup.querySelector<HTMLElement>(`.cast-wing.${side}`)!;
      wing.style.paddingLeft = `${layout.wings[side].start * layout.bodyHeight}px`;
      wing.style.paddingRight = `${layout.wings[side].end * layout.bodyHeight}px`;
    }
    const visible = new Set(layout.members.map((member) => member.id));
    for (const [id, element] of elements) element.hidden = !visible.has(id);
    for (const member of layout.members) {
      const element = elements.get(member.id)!;
      const [left, right] = CAST_HORIZONTAL_BOUNDS[member.id as Exclude<CharacterId, "bomb">];
      element.style.setProperty("--cast-slot-width", `${member.width}px`);
      element.style.setProperty("--cast-scale", String(member.scale));
      element.style.setProperty("--cast-anchor-offset", `${member.anchorOffset}px`);
      element.style.setProperty("--cast-paint-left", `${left * member.scale}px`);
      element.style.setProperty("--cast-paint-width", `${(right - left) * member.scale}px`);
    }
  };
  new ResizeObserver(fit).observe(lineup);
  window.addEventListener("resize", fit);
  const ticker = window.setInterval(() => {
    if (!rotating || !lineup.isConnected || lineup.clientWidth === 0 || document.hidden) return;
    rotation = (rotation + 1) % PRIORITY.length;
    fit();
  }, 1600);
  fit();
  return fit;
}
