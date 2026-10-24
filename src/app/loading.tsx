import { PlayerLoading } from "@/components/layout/PlayerLoading";

/**
 * Écran d'attente affiché aussitôt pendant le chargement d'une page hors du groupe (jeu)
 * (Espace Admin, retour au jeu depuis l'Espace Admin…) : avec le cadre du jeu pour un
 * joueur, plein écran pour un visiteur.
 */
export default function Loading() {
  return <PlayerLoading />;
}
