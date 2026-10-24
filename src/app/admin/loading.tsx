import { PlayerLoading } from "@/components/layout/PlayerLoading";

/**
 * En passant de l'espace joueur à l'Espace Admin : le cadre du jeu (rang, trophées,
 * titre, MemeMoney, navigation) reste affiché autour de l'écran d'attente.
 */
export default function Loading() {
  return <PlayerLoading />;
}
