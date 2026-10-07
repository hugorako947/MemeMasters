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
  backToHome = false,
  publicWidth,
}: {
  children: ReactNode;
  /** « ← Retour à l'accueil », aussi pour un joueur connecté. */
  backToHome?: boolean;
  publicWidth?: string;
}) {
  const user = await getAuthUser();
  const player = user ? await getPlayer(user.id) : null;
  if (player?.consentUpToDate) {
    return (
      <AppShell player={player} back={backToHome ? "/" : undefined}>
        {children}
      </AppShell>
    );
  }
  return <PublicShell width={publicWidth}>{children}</PublicShell>;
}
