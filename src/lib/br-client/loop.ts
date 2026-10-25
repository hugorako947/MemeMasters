/**
 * Rythme d'une partie dans le navigateur : le moteur avance à pas fixe (20 ticks par seconde) en suivant
 * l'horloge réelle, et l'affichage (60 images par seconde) se place entre les deux derniers ticks (alpha).
 *
 * Pas de pause : après une absence (onglet en arrière-plan), la partie rattrape les ticks manquants, par
 * paquets de `maxPerFrame` pour ne pas figer l'écran (conception §2 et §5.5).
 */
export class MatchClock {
  private origin = 0;
  ticksDone = 0;

  constructor(
    private readonly tickMs: number,
    private readonly maxPerFrame: number,
  ) {}

  start(now: number): void {
    this.origin = now;
    this.ticksDone = 0;
  }

  /** Ticks à calculer maintenant (comptés comme faits) et position de l'image entre deux ticks (0 à 1). */
  due(now: number): { ticks: number; alpha: number } {
    const elapsed = (now - this.origin) / this.tickMs;
    const owed = Math.floor(elapsed) - this.ticksDone;
    const ticks = Math.max(0, Math.min(owed, this.maxPerFrame));
    this.ticksDone += ticks;
    const alpha = owed > this.maxPerFrame ? 0 : Math.min(1, Math.max(0, elapsed - this.ticksDone));
    return { ticks, alpha };
  }

  /** Ticks encore en retard à l'instant `now` (rattrapage en cours). */
  behind(now: number): number {
    return Math.max(0, Math.floor((now - this.origin) / this.tickMs) - this.ticksDone);
  }
}
