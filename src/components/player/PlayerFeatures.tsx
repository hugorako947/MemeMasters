import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { sampleOf } from "@/components/card/sample-cards";
import { GAME_CONFIG } from "@/config/game.config";
import { RANK_REWARDS, rankFor, RANKS, rankIndex } from "@/config/ranks";
import type { Player } from "@/lib/server/players";
import { MemeCoin, RankShield, TrophyIcon } from "./RankBadge";

/**
 * Accueil du joueur : quatre cases simples (Boosters, Batailles, Collection,
 * Boutique). Les actions de jeu arrivent dans les phases 2 à 4.
 */
export async function PlayerFeatures({ player }: { player: Player }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BoostersPanel />
      <BattlesPanel player={player} />
      <CollectionPanel />
      <ShopPanel memeMoney={player.memeMoney} />
    </div>
  );
}

async function Panel({
  title,
  lead,
  tint,
  soon = true,
  children,
}: {
  title: string;
  lead: string;
  tint: string;
  soon?: boolean;
  children: ReactNode;
}) {
  const t = await getTranslations("playerHome");
  return (
    <section className="relative flex flex-col overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-surface p-5 shadow-[0_5px_0_0_var(--mm-shadow)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-3xl leading-none md:text-4xl">{title}</h2>
        {soon ? (
          <span className="shrink-0 rounded-full border-2 border-ink bg-sticker px-3 py-1 text-xs font-extrabold text-[#1a1238]">
            {t("soon")}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-ink-soft">{lead}</p>
      <div className={`mt-5 grid flex-1 rounded-2xl p-4 text-[#1a1238] ${tint}`}>{children}</div>
    </section>
  );
}

/** Le booster journalier multicolore, et les boosters à acheter en MemeMoney. */
async function BoostersPanel() {
  const t = await getTranslations("playerHome.boosters");
  const { DAILY_FREE_BOOSTERS, BOOSTER_SIZE, MEME_MONEY, GAME_NAME } = GAME_CONFIG;
  const extras = [
    { key: "extra", price: MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE },
    { key: "special", price: MEME_MONEY.SPECIAL_BOOSTER_PRICE },
    { key: "verySpecial", price: MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE },
  ] as const;
  return (
    <Panel title={t("title")} lead={t("lead", { count: DAILY_FREE_BOOSTERS, size: BOOSTER_SIZE })} tint="bg-[#ffe3ec]">
      <div className="grid h-full content-center items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div className="mm-pack-stage mx-auto w-36">
          <div className="mm-pack mm-pack--hero">
            <span className="mm-pack__tear" aria-hidden="true" />
            <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
            <span className="mm-pack__count">{t("cards", { count: BOOSTER_SIZE })}</span>
          </div>
        </div>
        <ul className="grid gap-2">
          {extras.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#1a1238] bg-white px-3 py-2 text-sm font-bold">
              <span>{t(e.key)}</span>
              <span className="flex items-center gap-1.5 font-display text-lg">
                <MemeCoin />
                {e.price}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Rang, trophées, prochaine récompense, et un duel pour donner envie. */
async function BattlesPanel({ player }: { player: Player }) {
  const t = await getTranslations("playerHome.battles");
  const tr = await getTranslations("rank");
  const format = await getFormatter();
  const rank = rankFor(player.trophies);
  const next = RANKS[rankIndex(player.trophies) + 1];
  return (
    <Panel title={t("title")} lead={t("lead", { team: GAME_CONFIG.TEAM_SIZE })} tint="bg-[#fff6c9]">
      <div className="grid gap-4">
        <div className="flex items-center gap-3">
          <RankShield rank={rank} size={40} />
          <p className="flex flex-1 items-baseline justify-between font-extrabold">
            <span>{tr(rank)}</span>
            <span className="flex items-center gap-1">
              <TrophyIcon size={16} />
              {format.number(player.trophies)}
            </span>
          </p>
        </div>
        {next ? (
          <p className="rounded-xl bg-white px-3 py-2 text-sm font-bold">
            🎁 {t("nextReward", { boosters: RANK_REWARDS[next].boosters, money: RANK_REWARDS[next].memeMoney })}
          </p>
        ) : null}
        <div className="mx-auto grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="-rotate-6">
            <InteractiveCard card={sampleOf("epique")} size="compact" />
          </div>
          <span className="meme-caption grid size-12 place-items-center rounded-full border-[3px] border-[#1a1238] bg-sticker text-xl" aria-hidden="true">
            VS
          </span>
          <div className="rotate-6">
            <InteractiveCard card={sampleOf("legendaire")} size="compact" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** La collection à remplir : des cartes encore floutées. */
async function CollectionPanel() {
  const t = await getTranslations("playerHome.collection");
  const preview = (["godlevel", "superbrainrot", "brainrot", "legendaire", "epique", "rare"] as const).map(sampleOf);
  return (
    <Panel title={t("title")} lead={t("lead")} tint="bg-[#e3f0ff]">
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
        <ul className="grid grid-cols-3 gap-2">
          {preview.map((c) => (
            <li key={c.id}>
              <InteractiveCard card={c} size="compact" owned={false} />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Accès à la boutique de MemeMoney. */
async function ShopPanel({ memeMoney }: { memeMoney: number }) {
  const t = await getTranslations("playerHome.shop");
  const format = await getFormatter();
  return (
    <Panel title={t("title")} lead={t("lead")} tint="bg-[#e7fbe9]" soon={false}>
      <div className="grid h-full content-center gap-5">
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="mm-coin-stack" aria-hidden="true">
            <MemeCoin />
            <MemeCoin />
            <MemeCoin />
          </span>
          <p className="font-display text-5xl leading-none">{format.number(memeMoney)}</p>
        </div>
        <p className="rounded-xl bg-white px-3 py-2 text-center text-sm font-bold">🔥 {t("teaser")}</p>
        <Link href="/boutique" className="mm-btn mm-btn--primary w-full">
          {t("cta")}
        </Link>
      </div>
    </Panel>
  );
}
