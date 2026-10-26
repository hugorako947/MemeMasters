/**
 * Ce qu'un participant voit (règles validées par le propriétaire le 2026-10-24) : la même règle
 * pour le joueur, l'aide à la visée et les bots. L'affichage de la phase 3 devra la respecter
 * (aucun ennemi ni objet montré au joueur hors de ces règles), sinon les bots ne seraient plus honnêtes.
 *
 * - Champ de vision : un rectangle fixe autour du participant (le même pour tous, quelle que soit la taille de l'écran),
 *   agrandi par une lunette ramassée dans une caisse (×2, ×4 : la même règle pour les bots).
 * - Ligne de vue : un mur ou une caisse entre les deux cache ce qui est derrière (l'eau et les buissons non).
 * - Buissons : un participant dans un buisson n'est visible que de tout près.
 */
import { lineOfSight, TILE, tileAt } from "./map";
import type { MatchState } from "./state";

/** Le point est dans le champ de vision du participant i (lunette comprise). */
export function inView(s: MatchState, i: number, x: number, y: number): boolean {
  const { halfWidth, halfHeight } = s.rules.view;
  const zoom = Math.max(1, s.p.scope[i]);
  return Math.abs(x - s.p.x[i]) <= halfWidth * zoom && Math.abs(y - s.p.y[i]) <= halfHeight * zoom;
}

/** Le point (un objet au sol) est visible du participant i : dans son champ de vision, sans mur entre les deux. */
export function canSeePoint(s: MatchState, i: number, x: number, y: number): boolean {
  return inView(s, i, x, y) && lineOfSight(s.map, s.p.x[i], s.p.y[i], x, y);
}

/** Le participant j (en vie) est visible du participant i. */
export function canSee(s: MatchState, i: number, j: number): boolean {
  const P = s.p;
  if (!P.alive[j] || !inView(s, i, P.x[j], P.y[j])) return false;
  const dx = P.x[j] - P.x[i];
  const dy = P.y[j] - P.y[i];
  const reveal = s.rules.view.bushReveal;
  if (tileAt(s.map, P.x[j], P.y[j]) === TILE.bush && dx * dx + dy * dy > reveal * reveal) return false;
  return lineOfSight(s.map, P.x[i], P.y[i], P.x[j], P.y[j]);
}
