import { getFormatter, getTranslations } from "next-intl/server";
import { PlayerCounts } from "@/components/player/PlayerCounts";
import type { ReactNode } from "react";
import { sampleOf } from "@/components/card/sample-cards";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { DuelScene } from "@/components/home/DuelScene";
import { TrainingPanel } from "@/components/match/TrainingPanel";
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
  boostersBadge = 0,
  challenge = null,
  counts,
  battleCardId = null,
  initial,
  param,
}: {
  player: Player;
  collection: CollectionItem[];
  boosters: BoosterStateView;
  boostersBadge?: number;
  challenge?: DailyChallenge | null;
  counts?: { accounts: number; online: number };
  /** Personnage du Battle Royale choisi dans la Collection (null : pas encore choisi). */
  battleCardId?: string | null;
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
        { key: "collection", label: t("collection.title"), content: <CollectionSlide items={collection} battleCardId={battleCardId} /> },
        { key: "boosters", label: t("boosters.title"), content: <BoostersSlide state={boosters} challenge={challenge} />, badge: boostersBadge },
        { key: "batailles", label: t("battles.title"), content: <BattlesSlide player={player} counts={counts} collection={collection} battleCardId={battleCardId} /> },
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

/**
 * Battle Royale : une illustration, rang, trophées et prochaine récompense, puis les modes de jeu et
 * l'Entraînement (personnage choisi dans la Collection, difficulté, commandes, lancement).
 */
async function BattlesSlide({
  player,
  counts,
  collection,
  battleCardId,
}: {
  player: Player;
  counts?: { accounts: number; online: number };
  collection: CollectionItem[];
  battleCardId: string | null;
}) {
  const t = await getTranslations("playerHome.battles");
  const tr = await getTranslations("rank");
  const chosen = collection.find((e) => e.card.id === battleCardId && e.quantity > 0);
  const format = await getFormatter();
  const rank = rankFor(player.trophies);
  const next = RANKS[rankIndex(player.trophies) + 1];
  return (
    <SlideFrame>
      <div className="mx-auto grid max-w-2xl gap-5">
        <DuelScene left={sampleOf("epique")} right={sampleOf("legendaire")} />
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
        <TrainingPanel
          player={{ name: player.username, trophies: player.trophies }}
          character={chosen ? { card: chosen.card, level: chosen.level } : null}
          cards={collection.map((e) => e.card)}
        />
      </div>
    </SlideFrame>
  );
}

/** La collection du joueur, directement consultable. */
async function CollectionSlide({ items, battleCardId }: { items: CollectionItem[]; battleCardId: string | null }) {
  return (
    <section className="rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      <CollectionBrowser items={items} battleCardId={battleCardId} />
    </section>
  );
}
