import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthUser, requirePlayer } from "@/lib/server/auth";

/**
 * Cadre des pages du jeu (Accueil, Boutique, Infos, Profil, Réglages).
 * - Joueur : le cadre du jeu (rang, trophées, MemeMoney, navigation), qui reste
 *   affiché d'une page à l'autre, écran de chargement compris.
 * - Visiteur : aucun cadre ; seul l'Accueil (vitrine) lui est montré. Chaque autre
 *   page du groupe appelle elle-même requirePlayer() et le renvoie vers la connexion
 *   (vérifié par guards.test.ts ; src/proxy.ts le fait aussi en amont).
 */
export default async function GameLayout({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  if (!user) return <div className="mm-public-frame">{children}</div>;
  const { player } = await requirePlayer();
  return <AppShell player={player}>{children}</AppShell>;
}
