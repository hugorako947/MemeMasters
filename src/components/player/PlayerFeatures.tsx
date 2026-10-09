import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { sampleOf } from "@/components/card/sample-cards";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { GAME_CONFIG } from "@/config/game.config";
import { isOfferActive, OFFERS } from "@/config/shop";
import { RANK_REWARDS, rankFor, RANKS, rankIndex } from "@/config/ranks";
import type { Player } from "@/lib/server/players";
import { BoostersPanel, type BoosterStateView } from "@/components/booster/BoostersPanel";
import { CollectionBrowser, type CollectionItem } from "@/components/collection/CollectionBrowser";
import { RankShield, TrophyIcon } from "./RankBadge";

export const HOME_SLIDES = ["collection", "boosters", "batailles"] as const;

/**
 * Accueil du joueur en pages glissantes : Collection (gauche), Boosters
 * (milieu, ouvert par défaut) et Batailles (droite). La Boutique est
 * suggérée discrètement dans la page Boosters.
 */
export async function PlayerFeatures({
  player,
  collection,
  boosters,
  resaleLeftCents,
  initial,
  param,
}: {
  player: Player;
  collection: CollectionItem[];
  boosters: BoosterStateView;
  resaleLeftCents: number;
  initial?: string;
  param?: string;
}) {
  const t = await getTranslations("playerHome");
  const index = HOME_SLIDES.indexOf((initial ?? "boosters") as (typeof HOME_SLIDES)[number]);
  return (
    <SlideDeck
      param={param}
      initial={index === -1 ? 1 : index}
      slides={[
        { key: "collection", label: t("collection.title"), content: <CollectionSlide items={collection} resaleLeftCents={resaleLeftCents} /> },
        { key: "boosters", label: t("boosters.title"), content: <BoostersSlide state={boosters} /> },
        { key: "batailles", label: t("battles.title"), content: <BattlesSlide player={player} /> },
      ]}
    />
  );
}

async function SlideFrame({ lead, tint, soon = false, children }: { lead: string; tint: string; soon?: boolean; children: ReactNode }) {
  const t = await getTranslations("playerHome");
  return (
    <section className="rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-soft sm:text-lg">{lead}</p>
        {soon ? (
          <span className="shrink-0 rounded-full border-2 border-ink bg-sticker px-3 py-1 text-xs font-extrabold text-[#1a1238]">{t("soon")}</span>
        ) : null}
      </div>
      <div className={`mt-4 rounded-2xl p-4 text-[#1a1238] sm:p-6 ${tint}`}>{children}</div>
    </section>
  );
}

/** Boosters : ouvrir tout de suite, acheter en MemeMoney, et un clin d'œil vers la Boutique. */
async function BoostersSlide({ state }: { state: BoosterStateView }) {
  const t = await getTranslations("playerHome");
  const doubleOffer = OFFERS.some((o) => o.kind === "first_purchase_double" && isOfferActive(o, new Date()));
  return (
    <SlideFrame lead={t("boosters.lead", { count: GAME_CONFIG.DAILY_FREE_BOOSTERS, size: GAME_CONFIG.BOOSTER_SIZE })} tint="bg-[#ffe3ec]">
      <BoostersPanel state={state} doubleOffer={doubleOffer} />
    </SlideFrame>
  );
}

/** Rang, trophées, prochaine récompense, et un duel pour donner envie. */
async function BattlesSlide({ player }: { player: Player }) {
  const t = await getTranslations("playerHome.battles");
  const tr = await getTranslations("rank");
  const format = await getFormatter();
  const rank = rankFor(player.trophies);
  const next = RANKS[rankIndex(player.trophies) + 1];
  return (
    <SlideFrame lead={t("lead")} tint="bg-[#fff6c9]" soon>
      <div className="mx-auto grid max-w-lg gap-5">
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
          <p className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold">
            {t("nextReward", { boosters: RANK_REWARDS[next].boosters, money: RANK_REWARDS[next].memeMoney })}
          </p>
        ) : null}
        <div className="mx-auto grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="-rotate-6">
            <InteractiveCard card={sampleOf("epique")} size="compact" />
          </div>
          <span className="meme-caption grid size-14 place-items-center rounded-full border-2 border-[#1a1238] bg-sticker text-2xl" aria-hidden="true">
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
  const t = await getTranslations("playerHome.collection");
  return (
    <section className="rounded-[1.75rem] border-2 border-ink bg-surface p-4 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      <p className="mb-4 text-ink-soft sm:text-lg">{t("lead")}</p>
      <CollectionBrowser items={items} resaleLeftCents={resaleLeftCents} />
    </section>
  );
}
