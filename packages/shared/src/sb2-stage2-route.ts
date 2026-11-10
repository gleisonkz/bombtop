import type { Facing } from "./state";

export interface Sb2Stage2RoutePosition { x: number; y: number }
export interface Sb2Stage2RouteMotion { facing: Facing; junction: boolean }

export interface Sb2Stage2ExitMotion {
  velocity: number;
  ascending: boolean;
  slow: boolean;
  target: { x: number; y: number };
}

/** C05763 e física vertical: mudança de aceleração e aterrissagem por célula. */
export function sb2Stage2ExitStep(position: Sb2Stage2RoutePosition, motion: Sb2Stage2ExitMotion):
  { vy: number; landed: boolean } {
  const x = Math.floor((position.x - 8) / 16);
  const y = Math.floor((position.y - 25) / 16);
  if (motion.slow && !motion.ascending && x === motion.target.x && y === motion.target.y) {
    position.x = (x + 1) * 16 + position.x - Math.floor(position.x);
    position.y = (y + 2) * 16 + position.y - Math.floor(position.y);
    motion.velocity = 0;
    return { vy: 0, landed: true };
  }
  // C05763 testa a palavra inteira +1C, mesmo quando ainda há fração +1E.
  if (!motion.slow && Math.floor(motion.velocity) === 0) motion.slow = true;
  const acceleration = motion.slow ? 1 / 16 : 1 / 2;
  if (motion.ascending) {
    if (!motion.velocity) motion.ascending = false;
    else motion.velocity = Math.max(0, motion.velocity - acceleration);
  } else motion.velocity += acceleration;
  const vy = motion.ascending ? -motion.velocity : motion.velocity;
  position.y += vy;
  return { vy, landed: false };
}

/** C05841/C05977: avanço automático em pixels nativos; não inclui saída aérea. */
export function sb2Stage2RouteStep(
  position: Sb2Stage2RoutePosition, motion: Sb2Stage2RouteMotion,
  background: readonly (readonly number[])[], randomWord: number,
): { vx: number; vy: number } {
  const cx = Math.floor((position.x - 8) / 16);
  const cy = Math.floor((position.y - 25) / 16);
  const code = (x: number, y: number) => (background[y]?.[x] ?? 0) & 63;
  const center = () => {
    position.x = (cx + 1) * 16 + position.x - Math.floor(position.x);
    position.y = (cy + 2) * 16 + position.y - Math.floor(position.y);
  };
  const horizontal = motion.facing === "right" || motion.facing === "left";
  const ahead = horizontal ? code(cx + (motion.facing === "right" ? 1 : -1), cy)
    : code(cx, cy + (motion.facing === "down" ? 1 : -1));
  if (ahead !== 8 && ahead !== 9 && ahead !== 10) {
    center();
    motion.facing = horizontal ? code(cx, cy + 1) === 8 ? "down" : "up"
      : code(cx + 1, cy) === 8 ? "right" : "left";
  }
  if (code(cx, cy) !== 10) motion.junction = false;
  else if (!motion.junction) {
    motion.junction = true;
    center();
    motion.facing = sb2Stage2JunctionDirection(motion.facing, randomWord);
  }
  const vx = motion.facing === "right" ? 2 : motion.facing === "left" ? -2 : 0;
  const vy = motion.facing === "down" ? 2 : motion.facing === "up" ? -2 : 0;
  position.x += vx;
  position.y += vy;
  return { vx, vy };
}

/** C5EB4D: indexada por (palavra nativa 0406 & 0x1e) / 2. */
const CHOICES: readonly Facing[] = [
  "right", "left", "down", "up", "right", "left", "down", "up",
  "right", "left", "down", "up", "right", "left", "down", "up",
];
const CODES = { right: 2, left: 4, down: 8, up: 16 } as const;
const OPPOSITE: Record<Facing, Facing> = { right: "left", left: "right", down: "up", up: "down" };

export interface Sb2Stage2Preparation {
  /** Quadros completos da animação C20950; inclui o quadro de entrada. */
  elapsed: number;
}

/**
 * C04468/C044E3: prepara sem movimento, depois desloca oito pixels e libera
 * velocidade dois. O avanço físico desse mesmo quadro é aplicado pelo chamador.
 * Não executa os cantos, junções ou a saída do transporte.
 */
export function sb2Stage2PreparationStep(state: Sb2Stage2Preparation, nativeCellOffset: number):
  { displacementY: number; velocityY: number; launched: boolean } {
  // C20950..C2096F: cinco quadros de animação com duração dois; a entrada
  // observada acrescenta um quadro e a sentinela 0FFF ocupa o último quadro.
  if (++state.elapsed <= 12) return { displacementY: 0, velocityY: 0, launched: false };
  const sign = nativeCellOffset < 0x480 ? 1 : -1;
  return { displacementY: sign * 8, velocityY: sign * 2, launched: true };
}

/** C05977: escolha isolada da junção 10; não executa o percurso ou sua animação. */
export function sb2Stage2JunctionDirection(facing: Facing, randomWord: number): Facing {
  const choice = CHOICES[(randomWord & 0x1e) >> 1]!;
  // O fallback nativo usa o código da direção corrente, não o índice aleatório anterior.
  return choice === OPPOSITE[facing] ? CHOICES[(CODES[facing] + 2) >> 1]! : choice;
}
