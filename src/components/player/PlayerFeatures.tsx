import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { sampleOf } from "@/components/card/sample-cards";
import { SlideDeck } from "@/components/ui/SlideDeck";
import { GAME_CONFIG } from "@/config/game.config";
import { isOfferActive, OFFERS } from "@/config/shop";
import { RANK_REWARDS, rankFor, RANKS, rankIndex } from "@/config/ranks";
import type { Player } from "@/lib/server/players";
import { MemeCoin, RankShield, TrophyIcon } from "./RankBadge";

export const HOME_SLIDES = ["collection", "boosters", "batailles"] as const;

/**
 * Accueil du joueur en pages glissantes : Collection (gauche), Boosters
 * (milieu, ouvert par défaut) et Batailles (droite). La Boutique est
 * suggérée discrètement dans la page Boosters.
 */
export async function PlayerFeatures({ player, initial, param }: { player: Player; initial?: string; param?: string }) {
  const t = await getTranslations("playerHome");
  const index = HOME_SLIDES.indexOf((initial ?? "boosters") as (typeof HOME_SLIDES)[number]);
  return (
    <SlideDeck
      param={param}
      initial={index === -1 ? 1 : index}
      slides={[
        { key: "collection", label: t("collection.title"), content: <CollectionSlide /> },
        { key: "boosters", label: t("boosters.title"), content: <BoostersSlide /> },
        { key: "batailles", label: t("battles.title"), content: <BattlesSlide player={player} /> },
      ]}
    />
  );
}

async function SlideFrame({ lead, tint, children }: { lead: string; tint: string; children: ReactNode }) {
  const t = await getTranslations("playerHome");
  return (
    <section className="rounded-[1.75rem] border-[3px] border-ink bg-surface p-4 shadow-[0_5px_0_0_var(--mm-shadow)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-soft sm:text-lg">{lead}</p>
        <span className="shrink-0 rounded-full border-2 border-ink bg-sticker px-3 py-1 text-xs font-extrabold text-[#1a1238]">{t("soon")}</span>
      </div>
      <div className={`mt-4 rounded-2xl p-4 text-[#1a1238] sm:p-6 ${tint}`}>{children}</div>
    </section>
  );
}

/** Le booster journalier multicolore, les boosters à acheter en MemeMoney, et un clin d'œil vers la Boutique. */
async function BoostersSlide() {
  const t = await getTranslations("playerHome");
  const { DAILY_FREE_BOOSTERS, BOOSTER_SIZE, MEME_MONEY, GAME_NAME } = GAME_CONFIG;
  const extras = [
    { key: "extra", price: MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE },
    { key: "special", price: MEME_MONEY.SPECIAL_BOOSTER_PRICE },
    { key: "verySpecial", price: MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE },
  ] as const;
  const doubleOffer = OFFERS.some((o) => o.kind === "first_purchase_double" && isOfferActive(o, new Date()));
  return (
    <SlideFrame lead={t("boosters.lead", { count: DAILY_FREE_BOOSTERS, size: BOOSTER_SIZE })} tint="bg-[#ffe3ec]">
      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr] md:gap-10">
        <div className="mm-pack-stage mx-auto w-40 sm:w-48">
          <div className="mm-pack mm-pack--hero">
            <span className="mm-pack__tear" aria-hidden="true" />
            <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
            <span className="mm-pack__count">{t("boosters.cards", { count: BOOSTER_SIZE })}</span>
          </div>
        </div>
        <div className="grid gap-3">
          <ul className="grid gap-2">
            {extras.map((e) => (
              <li key={e.key} className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#1a1238] bg-white px-4 py-2.5 font-bold">
                <span>{t(`boosters.${e.key}`)}</span>
                <span className="flex items-center gap-1.5 font-display text-xl">
                  <MemeCoin />
                  {e.price}
                </span>
              </li>
            ))}
          </ul>
          {/* Suggestion discrète vers la Boutique, au moment où l'on pense aux boosters. */}
          <Link
            href="/boutique"
            className="group flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[#1a1238]/40 px-4 py-2 text-sm font-semibold transition-colors hover:border-[#1a1238] hover:bg-white/70"
          >
            <span className="flex items-center gap-2">
              <MemeCoin />
              {doubleOffer ? t("shop.subtleDouble") : t("shop.subtle")}
            </span>
            <span className="shrink-0 font-extrabold text-candy-ink group-hover:underline">
              {t("shop.cta")} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
            </span>
          </Link>
        </div>
      </div>
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
    <SlideFrame lead={t("lead", { team: GAME_CONFIG.TEAM_SIZE })} tint="bg-[#fff6c9]">
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
            🎁 {t("nextReward", { boosters: RANK_REWARDS[next].boosters, money: RANK_REWARDS[next].memeMoney })}
          </p>
        ) : null}
        <div className="mx-auto grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="-rotate-6">
            <InteractiveCard card={sampleOf("epique")} size="compact" />
          </div>
          <span className="meme-caption grid size-14 place-items-center rounded-full border-[3px] border-[#1a1238] bg-sticker text-2xl" aria-hidden="true">
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

/** La collection à remplir : des cartes encore floutées. */
async function CollectionSlide() {
  const t = await getTranslations("playerHome.collection");
  const preview = (["godlevel", "superbrainrot", "brainrot", "legendaire", "epique", "rare"] as const).map(sampleOf);
  return (
    <SlideFrame lead={t("lead")} tint="bg-[#e3f0ff]">
      <div className="grid gap-4">
        <div className="rounded-xl border-2 border-[#1a1238] bg-white p-3">
          <p className="flex items-baseline justify-between text-sm font-extrabold">
            <span>{t("progress", { owned: 0 })}</span>
            <span className="opacity-70">0 %</span>
          </p>
          <div className="mm-stat-bar mt-2" aria-hidden="true">
            <span style={{ width: "2%", ["--bar" as string]: "#2d5bff" }} />
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {preview.map((c) => (
            <li key={c.id}>
              <InteractiveCard card={c} size="compact" owned={false} />
            </li>
          ))}
        </ul>
      </div>
    </SlideFrame>
  );
}
