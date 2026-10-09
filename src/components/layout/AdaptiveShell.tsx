import type { ReactNode } from "react";
import { getAuthUser } from "@/lib/server/auth";
import { getPlayer } from "@/lib/server/players";
import { AppShell } from "./AppShell";
import { PublicShell } from "./PublicShell";

/**
 * Pages accessibles à tous (raretés, textes légaux) : cadre du joueur s'il est
 * connecté (barre du haut et navigation), cadre public sinon.
 */
export async function AdaptiveShell({
  children,
  publicWidth,
}: {
  children: ReactNode;
  /** Conservé pour compatibilité : le visiteur a toujours « ← Retour à l'accueil », le joueur jamais. */
  backToHome?: boolean;
  publicWidth?: string;
}) {
  const user = await getAuthUser();
  const player = user ? await getPlayer(user.id) : null;
  // Joueur connecté : la barre de navigation suffit, pas de lien de retour.
  if (player?.consentUpToDate) return <AppShell player={player}>{children}</AppShell>;
  // Visiteur : « ← Retour à l'accueil ».
  return (
    <PublicShell width={publicWidth}>
      {children}
    </PublicShell>
  );
}
