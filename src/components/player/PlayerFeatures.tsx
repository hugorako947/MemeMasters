import { getFormatter, getTranslations } from "next-intl/server";
import { PlayerCounts } from "@/components/player/PlayerCounts";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { sampleOf } from "@/components/card/sample-cards";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { DailyChallengeCard } from "@/components/challenges/DailyChallengeCard";
import type { DailyChallenge } from "@/lib/server/challenges";
import { isOfferActive, OFFERS } from "@/config/shop";
import { RANK_REWARDS, rankFor, RANKS, rankIndex } from "@/config/ranks";
import type { Player } from "@/lib/server/players";
import { BoostersPanel, type BoosterStateView } from "@/components/booster/BoostersPanel";
import { CollectionBrowser, type CollectionItem } from "@/components/collection/CollectionBrowser";
import { RankShield, TrophyIcon } from "./RankBadge";

export const HOME_SLIDES = ["collection", "boosters", "batailles"] as const;

/**
 * Accueil du joueur en pages glissantes : Collection (gauche), Boosters
 * (milieu, ouvert par défaut) et Battle Royale (droite ; clé « batailles »
 * gardée dans l'adresse ?vue=…). La Boutique est suggérée discrètement dans
 * la page Boosters.
 */
export async function PlayerFeatures({
  player,
  collection,
  boosters,
  resaleLeftCents,
  boostersBadge = 0,
  challenge = null,
  counts,
  initial,
  param,
}: {
  player: Player;
  collection: CollectionItem[];
  boosters: BoosterStateView;
  resaleLeftCents: number;
  boostersBadge?: number;
  challenge?: DailyChallenge | null;
  counts?: { accounts: number; online: number };
  initial?: string;
  param?: string;
}) {
  const t = await getTranslations("playerHome");
  const index = HOME_SLIDES.indexOf((initial ?? "boosters") as (typeof HOME_SLIDES)[number]);
  return (
    <SlideDeck
      markSeen={{ boosters: "boosters" }}
      param={param}
      initial={index === -1 ? 1 : index}
      slides={[
        { key: "collection", label: t("collection.title"), content: <CollectionSlide items={collection} resaleLeftCents={resaleLeftCents} /> },
        { key: "boosters", label: t("boosters.title"), content: <BoostersSlide state={boosters} challenge={challenge} />, badge: boostersBadge },
        { key: "batailles", label: t("battles.title"), content: <BattlesSlide player={player} counts={counts} /> },
      ]}
    />
  );
}

/**
 * Cadre d'une page de l'Accueil, aux couleurs du thème choisi (comme la Collection et les
 * pages d'Infos) : panneau `bg-surface`, et à l'intérieur le fond des pages (`bg-paper`).
 */
async function SlideFrame({ soon = false, children }: { soon?: boolean; children: ReactNode }) {
  const t = await getTranslations("playerHome");
  return (
    <section className="grid gap-4 rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      {soon ? (
        <span className="justify-self-start rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-extrabold text-ink">{t("soon")}</span>
      ) : null}
      <div className="rounded-2xl bg-paper p-4 text-ink sm:p-6">{children}</div>
    </section>
  );
}

/** Boosters : ouvrir tout de suite, le défi du jour, puis acheter en MemeMoney (et un clin d'œil vers la Boutique). */
async function BoostersSlide({ state, challenge }: { state: BoosterStateView; challenge: DailyChallenge | null }) {
  const doubleOffer = OFFERS.some((o) => o.kind === "first_purchase_double" && isOfferActive(o, new Date()));
  return (
    <SlideFrame>
      <BoostersPanel state={state} doubleOffer={doubleOffer} challenge={challenge ? <DailyChallengeCard challenge={challenge} /> : null} />
    </SlideFrame>
  );
}

/** Battle Royale (bientôt) : rang, trophées, prochaine récompense, et deux personnages pour donner envie. */
async function BattlesSlide({ player, counts }: { player: Player; counts?: { accounts: number; online: number } }) {
  const t = await getTranslations("playerHome.battles");
  const tr = await getTranslations("rank");
  const format = await getFormatter();
  const rank = rankFor(player.trophies);
  const next = RANKS[rankIndex(player.trophies) + 1];
  return (
    <SlideFrame soon>
      <div className="mx-auto grid max-w-lg gap-5">
        {counts ? <PlayerCounts initial={counts} compact /> : null}
        <div className="flex items-center gap-3">
          <RankShield rank={rank} size={44} />
          <p className="flex flex-1 items-baseline justify-between text-lg font-extrabold">
            <span>{tr(rank)}</span>
            <span className="flex items-center gap-1">
              <TrophyIcon size={18} />
              {format.number(player.trophies)}
            </span>
          </p>
        </div>
        {next ? (
          <p className="rounded-xl border-2 border-ink bg-surface px-4 py-2.5 text-sm font-bold">
            {t("nextReward", { boosters: RANK_REWARDS[next].boosters, money: RANK_REWARDS[next].memeMoney })}
          </p>
        ) : null}
        <div className="mx-auto grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="-rotate-6">
            <InteractiveCard card={sampleOf("epique")} size="compact" />
          </div>
          <span className="meme-caption grid size-14 place-items-center rounded-full border-2 border-ink bg-surface text-2xl" aria-hidden="true">
            VS
          </span>
          <div className="rotate-6">
            <InteractiveCard card={sampleOf("legendaire")} size="compact" />
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

/** La collection du joueur, directement consultable. */
async function CollectionSlide({ items, resaleLeftCents }: { items: CollectionItem[]; resaleLeftCents: number }) {
  return (
    <section className="rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      <CollectionBrowser items={items} resaleLeftCents={resaleLeftCents} />
    </section>
  );
}
