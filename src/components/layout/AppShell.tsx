import Link from "next/link";
import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { MemeCoin, RankShield, TrophyIcon } from "@/components/player/RankBadge";
import { rankFor } from "@/config/ranks";
import { getBadges, type Badges } from "@/lib/server/notifications";
import type { Player } from "@/lib/server/players";
import { BackLink } from "./BackLink";
import { BottomNav } from "./BottomNav";
import { PreferenceSync } from "./PreferenceSync";
import { SiteFooter } from "./SiteFooter";

/**
 * Cadre des pages du joueur :
 * en haut, le rang et les trophées (gauche), le titre (centre), la MemeMoney (droite) ;
 * en bas, la navigation, au-dessus du pied de page. Pas de fil d'Ariane.
 */
export async function AppShell({ player, back, children, badges }: { player: Player; back?: string; children: ReactNode; badges?: Badges }) {
  // Points rouges de notification (calculés par le serveur, sauf dans l'aperçu).
  const dots = badges ?? (await getBadges(player));
  const t = await getTranslations();
  const format = await getFormatter();
  const rank = rankFor(player.trophies);
  const rankName = t(`rank.${rank}`);
  const profileHref = `/profil/${encodeURIComponent(player.username)}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <PreferenceSync locale={player.locale} appearance={player.appearance} />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("nav.skipToContent")}
      </a>

      <header className="safe-top mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-3 md:px-6">
        <Link
          href={profileHref}
          className="flex items-center gap-2 justify-self-start rounded-full border-2 border-ink bg-surface py-1 ps-1.5 pe-3 shadow-[0_3px_0_0_var(--mm-shadow)] transition-transform hover:-translate-y-0.5"
          aria-label={t("hud.rankLabel", { rank: rankName, count: player.trophies })}
        >
          <RankShield rank={rank} size={24} />
          <span className="flex flex-col leading-none">
            <span className="hidden text-[0.7rem] font-bold text-ink-soft sm:block">{rankName}</span>
            <span className="flex items-center gap-1 font-display text-lg">
              <TrophyIcon size={15} />
              {format.number(player.trophies)}
            </span>
          </span>
        </Link>

        <div className="justify-self-center">
          <Logo />
        </div>

        <Link
          href="/boutique"
          className="flex items-center gap-2 justify-self-end rounded-full border-2 border-ink bg-surface py-1 ps-1.5 pe-2 shadow-[0_3px_0_0_var(--mm-shadow)] transition-transform hover:-translate-y-0.5"
          aria-label={t("hud.memeMoneyLabel", { amount: player.memeMoney })}
        >
          <MemeCoin />
          <span className="font-display text-lg leading-none">{format.number(player.memeMoney)}</span>
          <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-candy text-sm font-extrabold leading-none text-[var(--mm-accent-ink)]">
            +
          </span>
        </Link>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 md:px-6">
        {back ? (
          <div className="mb-3">
            <BackLink to={back} />
          </div>
        ) : null}
        <main id="contenu" className="pb-6">
          {children}
        </main>
      </div>

      <BottomNav username={player.username} badges={{ shop: dots.shop, infos: dots.infos, home: dots.home, profile: dots.profile }} />
      <SiteFooter />
    </div>
  );
}
