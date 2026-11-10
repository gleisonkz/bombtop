import { TILE } from "./constants";
import { canPlayerEnterTile } from "./movement";
import { playerElevated } from "./player-carry";
import { bombAt, getTile, Tile, DIR_VECTORS, type Direction, type MatchState, type Player } from "./state";

/**
 * Passo manual nativo, reutilizando a consulta de colisão do Bombtop.
 * A correção transversal tem orçamento próprio e depende de cruzar um pixel
 * inteiro no eixo de avanço. Não substitui gelo, salto, chute ou empurrão.
 */
export function moveSb2Player(s: MatchState, p: Player, dir: Direction, nativeSpeed: number,
  transverseSpeed = nativeSpeed, integerAlignment = false, cornerSpeed = nativeSpeed, clampLateralObjects = true): void {
  if (!dir || !p.alive || playerElevated(p)) return;
  const [dx, dy] = DIR_VECTORS[dir];
  const horizontal = dx !== 0;
  const sign = horizontal ? dx : dy;
  const unitsPerPixel = TILE / 16;
  let along = (horizontal ? p.px : p.py) / unitsPerPixel;
  let across = (horizontal ? p.py : p.px) / unitsPerPixel;
  // A consulta nativa da linha usa Y-25, um pixel acima do centro convertido.
  const ta = Math.floor((along - (horizontal ? 0 : 1)) / 16);
  const tc = Math.floor((across - (horizontal ? 1 : 0)) / 16);
  const centerAlong = ta * 16 + 8, centerAcross = tc * 16 + 8;
  const passable = (a: number, c: number) => horizontal
    ? canPlayerEnterTile(s, p, a, c) : canPlayerEnterTile(s, p, c, a);
  const objectAt = (a: number, c: number) => {
    const [x, y] = horizontal ? [a, c] : [c, a];
    return getTile(s, x, y) === Tile.Block || !!bombAt(s, x, y);
  };
  const leavingBomb = horizontal ? !!bombAt(s, ta, tc) : !!bombAt(s, tc, ta);
  if (passable(ta + sign, tc)) {
    const next = along + sign * nativeSpeed;
    const reachesCenter = integerAlignment && Math.floor(next) === centerAlong;
    if (Math.floor(next) !== Math.floor(along) && !reachesCenter) {
      const correction = integerAlignment ? Math.sign(centerAcross - Math.floor(across))
        : across < centerAcross ? 1 : across > centerAcross + 1 ? -1 : 0;
      const corrected = across + correction * transverseSpeed;
      const crossed = integerAlignment ? correction * (Math.floor(corrected) - centerAcross) > 0
        : correction > 0 && corrected > centerAcross + 1 || correction < 0 && corrected < centerAcross;
      across = crossed ? centerAcross + corrected - Math.floor(corrected) : corrected;
    }
    along = next;
  } else {
    const side = across < centerAcross ? -1 : across > centerAcross + 1 ? 1 : 0;
    if (side && passable(ta, tc + side) && passable(ta + sign, tc + side)) {
      across += side * cornerSpeed;
    } else {
      const next = along + sign * nativeSpeed;
      // No bloqueio, só a parte inteira é limitada; a fração continua avançando.
      along = sign * (Math.floor(next) - centerAlong) > 0
        ? centerAlong + next - Math.floor(next) : next;
    }
  }
  const lateral = Math.sign(Math.floor(across) - centerAcross);
  const nextTile = Math.floor((along - (horizontal ? 0 : 1)) / 16);
  // Limite observado junto a bombas e blocos destrutíveis, além da faixa do pilar fixo.
  if (clampLateralObjects && lateral && (leavingBomb || objectAt(nextTile, tc + lateral))) across = centerAcross + across - Math.floor(across);
  if (horizontal) { p.px = along * unitsPerPixel; p.py = across * unitsPerPixel; }
  else { p.py = along * unitsPerPixel; p.px = across * unitsPerPixel; }
}
