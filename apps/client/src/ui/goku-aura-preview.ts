import auraSheet from "../../public/sprites/goku-ssj-aura.json";

// Menu-only contract for the approved 60-frame lobby/victory strip at 20fps.
const LOBBY_FRAMES = 60;
const HAIR_RISE = 9;
const FULL_POWER = 18;
const REVERSE = 33;
const BLACK_HAIR = 50;

function auraFrame(frame: number): number | undefined {
  if (frame < HAIR_RISE || frame >= BLACK_HAIR) return undefined;
  if (frame < FULL_POWER) {
    return auraSheet.intro[Math.floor((frame - HAIR_RISE) * auraSheet.intro.length / (FULL_POWER - HAIR_RISE))];
  }
  if (frame < REVERSE) return auraSheet.loop[(frame - FULL_POWER) % auraSheet.loop.length];
  return auraSheet.release[Math.floor((frame - REVERSE) * auraSheet.release.length / (BLACK_HAIR - REVERSE))];
}

/** Decorative sibling: native atlas pixels, uniformly scaled around the shared foot anchor. */
export function gokuAuraPreview(sprite: HTMLElement, seconds: number): HTMLElement {
  const aura = document.createElement("span");
  aura.className = "goku-aura-preview";
  aura.setAttribute("aria-hidden", "true");
  aura.style.setProperty("--s", sprite.style.getPropertyValue("--s"));
  Object.assign(aura.style, {
    position: "absolute",
    pointerEvents: "none",
    width: `${auraSheet.frameW}px`,
    height: `${auraSheet.frameH}px`,
    // Cast strips crop transparent side margins; their anchor offset is already corrected.
    left: `calc(var(--cast-anchor-offset, 50%) - ${auraSheet.anchorX}px)`,
    top: `calc(100% - ${auraSheet.anchorY}px)`,
    transformOrigin: `${auraSheet.anchorX}px ${auraSheet.anchorY}px`,
    transform: `scale(calc(var(--s) * ${auraSheet.nativeScaleForA1}))`,
    backgroundImage: `url(${import.meta.env.BASE_URL}${auraSheet.image})`,
    backgroundSize: `${auraSheet.width}px ${auraSheet.height}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
    mixBlendMode: "normal",
    opacity: "0",
    // Cast CSS keeps the ancestors context-free so this joins the shared cast backdrop.
    zIndex: "-2",
  });
  sprite.style.zIndex = "1";
  const keyframes: Keyframe[] = Array.from({ length: LOBBY_FRAMES + 1 }, (_, frame) => {
    const cell = auraFrame(frame);
    return {
      offset: frame / LOBBY_FRAMES,
      opacity: cell === undefined ? 0 : 1,
      backgroundPosition: `${-((cell ?? 0) % auraSheet.columns) * auraSheet.frameW}px ${-Math.floor((cell ?? 0) / auraSheet.columns) * auraSheet.frameH}px`,
      easing: "steps(1, end)",
    };
  });
  const animation = aura.animate(keyframes, { duration: seconds * 1000, iterations: Infinity });
  const reset = () => {
    animation.pause();
    animation.currentTime = 0;
  };
  reset();
  // CSS doesn't acquire its timeline origin until insertion/style resolution. Copy that
  // exact origin, not the event delivery time, including when hidden cast slots restart.
  sprite.addEventListener("animationstart", (event) => {
    if (event.target !== sprite) return;
    const source = sprite.getAnimations().find(candidate =>
      "animationName" in candidate && candidate.animationName === event.animationName);
    if (source?.startTime != null) animation.startTime = source.startTime;
  });
  // Reduced-motion CSS disables the character animation; its aura stays at invisible frame 0.
  sprite.addEventListener("animationcancel", reset);
  return aura;
}
