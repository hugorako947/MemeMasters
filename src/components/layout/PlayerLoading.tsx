import { getAuthUser } from "@/lib/server/auth";
import { getBadges, type Badges } from "@/lib/server/notifications";
import { getPlayer, type Player } from "@/lib/server/players";
import { AppShell } from "./AppShell";
import { LoadingScreen } from "./LoadingScreen";

/**
 * Écran d'attente d'une page hors du groupe (jeu), par exemple en passant de l'espace
 * joueur à l'Espace Admin, ou en revenant au jeu. Pour un joueur connecté, il garde le
 * cadre du jeu (rang et trophées, titre, MemeMoney, navigation) autour des cartes
 * animées, comme entre deux pages du jeu. Visiteur, compte sans profil ou incident de
 * lecture : l'écran plein écran habituel (une page d'attente ne doit jamais planter).
 */
export async function PlayerLoading() {
  const frame = await frameData();
  if (!frame) return <LoadingScreen fullscreen />;
  return (
    <AppShell player={frame.player} badges={frame.badges}>
      <LoadingScreen />
    </AppShell>
  );
}

async function frameData(): Promise<{ player: Player; badges: Badges } | null> {
  try {
    const user = await getAuthUser();
    const player = user ? await getPlayer(user.id) : null;
    if (!player || !player.consentUpToDate || player.ban) return null;
    return { player, badges: await getBadges(player) };
  } catch {
    return null;
  }
}
