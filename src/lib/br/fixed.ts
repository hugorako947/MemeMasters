/**
 * Mathématiques entières du moteur du battle royale.
 *
 * Tout le moteur calcule en nombres entiers : les fonctions flottantes de
 * JavaScript (Math.sin, Math.cos, Math.atan2, Math.sqrt…) peuvent donner des
 * résultats légèrement différents d'un navigateur à l'autre, ce qui casserait le
 * rejeu d'une partie par le serveur. Les additions, soustractions et
 * multiplications d'entiers (jusqu'à 2^53) sont exactes partout.
 *
 * Ce fichier est le seul du moteur à utiliser l'opérateur de division : toutes
 * les divisions passent par idiv() ou floorDiv(), corrigées pour être exactes.
 */

/** Un tour complet = 256 pas d'angle. 0 = vers la droite (+x), 64 = vers le bas (+y). */
export const ANGLE_STEPS = 256;
/** Les sinus et cosinus sont des entiers en Q14 : 16 384 représente 1. */
export const Q14 = 16384;

/** Quart d'onde du sinus, en Q14 : SIN_QUARTER[i] = round(sin(i × 2π / 256) × 16 384), i = 0…64. */
const SIN_QUARTER = [
  0, 402, 804, 1205, 1606, 2006, 2404, 2801, 3196, 3590, 3981, 4370, 4756, 5139, 5520, 5897, 6270, 6639, 7005, 7366, 7723, 8076, 8423, 8765, 9102,
  9434, 9760, 10080, 10394, 10702, 11003, 11297, 11585, 11866, 12140, 12406, 12665, 12916, 13160, 13395, 13623, 13842, 14053, 14256, 14449, 14635,
  14811, 14978, 15137, 15286, 15426, 15557, 15679, 15791, 15893, 15986, 16069, 16143, 16207, 16261, 16305, 16340, 16364, 16379, 16384,
] as const;

/** tan((k + ½) × 2π / 256) en Q16, k = 0…31 : frontières entre deux pas d'angle dans un octant. */
const TAN_MID_Q16 = [
  804, 2414, 4026, 5644, 7268, 8901, 10545, 12202, 13874, 15564, 17273, 19005, 20762, 22546, 24360, 26208, 28093, 30018, 31986, 34002, 36071, 38196,
  40382, 42636, 44963, 47369, 49863, 52451, 55144, 57950, 60880, 63947,
] as const;

/** Sinus d'un angle (en pas, quelconque), en Q14. */
export function isin(angle: number): number {
  const a = angle & 255;
  if (a <= 64) return SIN_QUARTER[a];
  if (a <= 128) return SIN_QUARTER[128 - a];
  if (a <= 192) return -SIN_QUARTER[a - 128];
  return -SIN_QUARTER[256 - a];
}

/** Cosinus d'un angle (en pas, quelconque), en Q14. */
export function icos(angle: number): number {
  return isin(angle + 64);
}

/** Pas d'angle (0…32) dont la tangente est la plus proche de num / den, avec 0 ≤ num ≤ den et den > 0. */
function octantSteps(num: number, den: number): number {
  const target = num * 65536;
  let lo = 0;
  let hi: number = TAN_MID_Q16.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (TAN_MID_Q16[mid] * den < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Angle (0…255) du vecteur (dx, dy), arrondi au pas le plus proche. Vecteur nul : 0. */
export function iatan2(dy: number, dx: number): number {
  if (dx === 0 && dy === 0) return 0;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const a = ay <= ax ? octantSteps(ay, ax) : 64 - octantSteps(ax, ay);
  if (dx >= 0) return dy >= 0 ? a & 255 : (256 - a) & 255;
  return dy >= 0 ? 128 - a : 128 + a;
}

/** Écart le plus court pour aller de l'angle `from` à l'angle `to`, dans [-128, 127]. */
export function angleDiff(to: number, from: number): number {
  return ((to - from + 128) & 255) - 128;
}

/** Division entière tronquée vers zéro (comme en C), exacte. b ≠ 0. */
export function idiv(a: number, b: number): number {
  let q = Math.trunc(a / b);
  const r = a - q * b;
  if (r !== 0) {
    const sameSign = a > 0 === b > 0;
    // Le quotient flottant peut être arrondi d'une unité de trop ou de trop peu : on le corrige.
    if (r > 0 !== a > 0) q += sameSign ? -1 : 1;
    else if (Math.abs(r) >= Math.abs(b)) q += sameSign ? 1 : -1;
  }
  return q + 0; // évite -0
}

/** Partie entière de a / b (arrondi vers -∞), exacte. b ≠ 0. */
export function floorDiv(a: number, b: number): number {
  const q = idiv(a, b);
  const r = a - q * b;
  return r !== 0 && r < 0 !== b < 0 ? q - 1 : q;
}

/** Racine carrée entière (partie entière de √n), par la méthode de Newton sur les entiers. */
export function isqrt(n: number): number {
  if (n < 2) return n < 0 ? 0 : n;
  // Point de départ au-dessus de la racine : une puissance de 2.
  let x = 1;
  for (let t = n; t >= 4; t = floorDiv(t, 4)) x *= 2;
  x *= 2;
  for (;;) {
    const y = floorDiv(x + floorDiv(n, x), 2);
    if (y >= x) return x;
    x = y;
  }
}

/** Borne v dans [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Entier uniforme dans [0, n) à partir d'un entier uniforme 32 bits (n ≤ 2^21). */
export function scaleU32(u32: number, n: number): number {
  return floorDiv(u32 * n, 4294967296);
}
