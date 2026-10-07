import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { GAME_CONFIG } from "@/config/game.config";
import { progressToNextRank, RANK_REWARDS, rankFor } from "@/config/ranks";
import type { Player } from "@/lib/server/players";
import { MemeCoin, RankShield, TrophyIcon } from "./RankBadge";

/**
 * Accueil du joueur : les trois piliers du jeu, mis en scène avec ses vraies
 * données (rang, trophées, MemeMoney). Les actions arrivent dans les phases 2 à 4.
 */
export async function PlayerFeatures({ player }: { player: Player }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BoostersPanel memeMoney={player.memeMoney} />
      <BattlesPanel player={player} />
      <CollectionPanel />
    </div>
  );
}

async function Panel({
  title,
  lead,
  tint,
  children,
  wide = false,
}: {
  title: string;
  lead: string;
  tint: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = await getTranslations("playerHome");
  return (
    <section
      className={`relative overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-surface p-5 shadow-[0_5px_0_0_var(--mm-shadow)] md:p-6 ${wide ? "lg:col-span-2" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-3xl leading-none md:text-4xl">{title}</h2>
        <span className="shrink-0 rounded-full border-2 border-ink bg-sticker px-3 py-1 text-xs font-extrabold text-[#1a1238]">
          {t("soon")}
        </span>
      </div>
      <p className="mt-2 text-ink-soft">{lead}</p>
      <div className={`mm-keep-colors mt-5 rounded-2xl p-4 ${tint}`}>{children}</div>
    </section>
  );
}

/** Les boosters du jour, et la boutique MemeMoney. */
async function BoostersPanel({ memeMoney }: { memeMoney: number }) {
  const t = await getTranslations("playerHome.boosters");
  const { DAILY_FREE_BOOSTERS, BOOSTER_SIZE, MEME_MONEY, GAME_NAME } = GAME_CONFIG;
  const shop = [
    { key: "extra", cls: "", price: MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE },
    { key: "special", cls: "mm-pack--special", price: MEME_MONEY.SPECIAL_BOOSTER_PRICE },
    { key: "verySpecial", cls: "mm-pack--ultra", price: MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE },
  ] as const;
  return (
    <Panel title={t("title")} lead={t("lead", { count: DAILY_FREE_BOOSTERS, size: BOOSTER_SIZE })} tint="bg-[#ffe3ec]" wide>
      <div className="grid min-w-0 items-end gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-3 text-sm font-extrabold text-[#1a1238]">{t("ready", { count: DAILY_FREE_BOOSTERS })}</p>
          <ul className="grid max-w-sm grid-cols-3 items-end gap-3">
            {Array.from({ length: DAILY_FREE_BOOSTERS }, (_, i) => (
              <li key={i} className={`min-w-0 ${i % 2 ? "mm-float [animation-delay:-1.3s]" : "mm-float"}`}>
                <div className="mm-pack">
                  <span className="mm-pack__tear" aria-hidden="true" />
                  <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
                  <span className="mm-pack__count">{t("cards", { count: BOOSTER_SIZE })}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border-2 border-[#1a1238] bg-white p-3 text-[#1a1238]">
          <p className="flex items-center justify-between text-sm font-extrabold">
            <span>{t("shop")}</span>
            <span className="flex items-center gap-1.5">
              <MemeCoin />
              {memeMoney}
            </span>
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
            {shop.map((item) => (
              <li key={item.key}>
                <div className={`mm-pack mx-auto w-14 ${item.cls}`}>
                  <span className="mm-pack__tear" aria-hidden="true" />
                </div>
                <p className="mt-2 text-xs font-bold leading-tight">{t(item.key)}</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-xs font-extrabold">
                  <MemeCoin className="text-[0.7rem]" />
                  {item.price}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/** Rang, trophées, prochaine récompense. */
async function BattlesPanel({ player }: { player: Player }) {
  const t = await getTranslations("playerHome.battles");
  const tr = await getTranslations("rank");
  const format = await getFormatter();
  const rank = rankFor(player.trophies);
  const progress = progressToNextRank(player.trophies);
  const { TROPHIES, MEME_MONEY, TEAM_SIZE } = GAME_CONFIG;
  const fighters = [SAMPLE_CARDS.find((c) => c.rarity === "mystique")!, SAMPLE_CARDS.find((c) => c.rarity === "legendaire")!];
  return (
    <Panel title={t("title")} lead={t("lead", { team: TEAM_SIZE })} tint="bg-[#fff6c9]">
      <div className="grid gap-4 text-[#1a1238]">
        <div className="flex items-center gap-3">
          <RankShield rank={rank} size={40} />
          <div className="flex-1">
            <p className="flex items-baseline justify-between text-sm font-extrabold">
              <span>{tr(rank)}</span>
              <span className="flex items-center gap-1">
                <TrophyIcon size={14} />
                {format.number(player.trophies)}
              </span>
            </p>
            {progress ? (
              <>
                <div className="mm-stat-bar mt-1.5 border-2 border-[#1a1238]" aria-hidden="true">
                  <span style={{ width: `${(progress.current / progress.needed) * 100}%`, ["--bar" as string]: "#ff3d7f" }} />
                </div>
                <p className="mt-1 text-xs font-semibold">
                  {t("toNext", { left: progress.needed - progress.current, rank: tr(progress.next) })}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs font-semibold">{t("top")}</p>
            )}
          </div>
          {progress ? <RankShield rank={progress.next} size={28} /> : null}
        </div>
        {progress ? (
          <p className="rounded-xl bg-white px-3 py-2 text-xs font-bold">
            🎁{" "}
            {t("nextReward", {
              rank: tr(progress.next),
              boosters: RANK_REWARDS[progress.next].boosters,
              money: RANK_REWARDS[progress.next].memeMoney,
            })}
          </p>
        ) : null}
        <div className="mx-auto grid w-full max-w-xs grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="-rotate-6">
            <InteractiveCard card={fighters[0]} size="compact" />
          </div>
          <span
            className="meme-caption grid size-12 place-items-center rounded-full border-[3px] border-[#1a1238] bg-sticker text-xl"
            aria-hidden="true"
          >
            VS
          </span>
          <div className="rotate-6">
            <InteractiveCard card={fighters[1]} size="compact" />
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <li className="rounded-lg bg-white px-1 py-2">
            {t("win")}
            <br />
            <span className="text-success">+{TROPHIES.WIN} 🏆 · +{MEME_MONEY.WIN_REWARD} M</span>
          </li>
          <li className="rounded-lg bg-white px-1 py-2">
            {t("draw")}
            <br />
            <span>+{TROPHIES.DRAW} 🏆</span>
          </li>
          <li className="rounded-lg bg-white px-1 py-2">
            {t("loss")}
            <br />
            <span className="text-danger">−{TROPHIES.LOSS} 🏆</span>
          </li>
        </ul>
      </div>
    </Panel>
  );
}

/** La collection à remplir : des cartes encore floutées. */
async function CollectionPanel() {
  const t = await getTranslations("playerHome.collection");
  const preview = ["godlevel", "superbrainrot", "omniversal", "legendaire", "mystique", "epique"].map(
    (r) => SAMPLE_CARDS.find((c) => c.rarity === r)!,
  );
  return (
    <Panel title={t("title")} lead={t("lead")} tint="bg-[#e3f0ff]">
      <div className="grid gap-4 text-[#1a1238]">
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
        <p className="text-xs font-semibold">{t("hint")}</p>
      </div>
    </Panel>
  );
}
