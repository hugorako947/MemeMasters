import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerFeatures } from "@/components/player/PlayerFeatures";
import { ProfileView } from "@/components/player/ProfileView";
import { SettingsView } from "@/components/player/SettingsView";
import { ShopView } from "@/components/player/ShopView";
import { InfosView } from "@/components/infos/InfosView";
import { BattleArena } from "@/components/battle/BattleArena";
import { STARTER_SET } from "@/content/cards/starter-set";
import type { Leaderboard, LeaderboardScope } from "@/lib/server/leaderboard";
import type { Player, PublicProfile } from "@/lib/server/players";
import { parseAppearance, THEME_COOKIES } from "@/lib/theme/theme";

/**
 * Aperçu des pages joueur avec des données fictives, pour travailler le design
 * sans compte ni base de données. DÉVELOPPEMENT UNIQUEMENT : introuvable en production.
 *   /apercu?vue=accueil | profil | reglages | boutique | infos | bataille&onglet=…&trophees=1240&pays=FR
 */
export default async function PreviewPage({ searchParams }: PageProps<"/apercu">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  // Le thème de l'aperçu suit les cookies de l'appareil (pas de compte à synchroniser).
  const jar = await cookies();
  const appearance = parseAppearance({
    theme: jar.get(THEME_COOKIES.theme)?.value,
    accent: jar.get(THEME_COOKIES.accent)?.value,
    base: jar.get(THEME_COOKIES.base)?.value,
  });
  const view = typeof params.vue === "string" ? params.vue : "accueil";
  const trophies = Number(params.trophees ?? 1240) || 0;
  const day = 86_400_000;
  // Date fixe : la page reste identique d'un affichage à l'autre.
  const now = Date.parse("2026-10-07T12:00:00Z");
  const player: Player = {
    id: "00000000-0000-4000-8000-000000000001",
    username: "HugoTest",
    trophies,
    highestRank: Math.min(9, Math.floor(trophies / 1000)),
    memeMoney: 37,
    wins: 58,
    losses: 31,
    draws: 6,
    rankedGames: 95,
    avatarCardId: null,
    timezone: "Europe/Paris",
    timezoneChangedAt: null,
    locale: null,
    appearance,
    createdAt: new Date(now - 75 * day),
    consentUpToDate: true,
  };
  // Courbe fictive : montée irrégulière jusqu'au total actuel.
  const history = Array.from({ length: 60 }, (_, i) => ({
    at: new Date(now - (70 - i) * day).toISOString(),
    trophies: Math.max(0, Math.round((trophies * i) / 59 + Math.sin(i) * 60)),
    rank: 0,
  }));
  const profile: PublicProfile = {
    id: player.id,
    username: player.username,
    trophies,
    highestRank: player.highestRank,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    createdAt: player.createdAt,
    currentStreak: 3,
    bestStreak: 7,
    history,
    asOf: new Date(now).toISOString(),
  };
  return (
    <AppShell player={player}>
      {view === "profil" ? (
        <ProfileView profile={profile} viewer={player} />
      ) : view === "bataille" ? (
        <BattleArena deck={STARTER_SET.slice(0, 8)} botDeck={STARTER_SET.slice(20, 28)} seed={20261009} playerName={player.username} />
      ) : view === "infos" ? (
        <InfosView boards={fakeBoards(player.trophies)} trophies={player.trophies} highestRank={player.highestRank} initial={typeof params.onglet === "string" ? params.onglet : undefined} param="onglet" />
      ) : view === "boutique" ? (
        <ShopView country={typeof params.pays === "string" ? params.pays : "FR"} hasPurchased={false} />
      ) : view === "reglages" ? (
        <SettingsView player={player} email="joueur@exemple.fr" />
      ) : (
        <div className="grid gap-6">
          <h1 className="font-display text-4xl leading-none md:text-5xl">{(await getTranslations("playerHome"))("title", { username: player.username })}</h1>
          <PlayerFeatures
            player={player}
            collection={STARTER_SET.map((card, i) => ({
              card,
              quantity: i === 0 ? 14 : i % 3 === 0 ? 0 : (i % 4) + 1,
              variant: i === 0 ? ("gold" as const) : i === 1 ? ("divine" as const) : ("normal" as const),
              firstObtainedAt: null,
            }))}
            resaleLeftCents={1650}
            boosters={{ freeLeft: 2, freePerDay: 3, dailyReserve: 1, special: 1, verySpecial: 0, memeMoney: player.memeMoney }}
            initial={typeof params.onglet === "string" ? params.onglet : undefined}
            param="onglet"
          />
        </div>
      )}
    </AppShell>
  );
}

/** Classement fictif pour l'aperçu. */
function fakeBoards(trophies: number): Record<LeaderboardScope, Leaderboard> {
  const names = ["MemeLord", "PixelCat", "Brainrotix", "LeChatQuiJuge", "Mamie_WiFi", "NPC_42", "Tralala", "SkibidiFan", "PigeonPensif"];
  const make = (top: number, start: number, me: number) => ({
    rows: Array.from({ length: 9 }, (_, i) => ({
      position: start + i,
      username: i === me ? "HugoTest" : names[i],
      trophies: i === me ? trophies : Math.max(0, top - i * 37),
      isMe: i === me,
    })),
    position: start + me,
    total: 1200,
  });
  return { around: make(trophies + 150, 410, 4), rank: make(1980, 1, 6), world: make(9840, 1, 99) };
}
