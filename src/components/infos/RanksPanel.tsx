import { getFormatter, getTranslations } from "next-intl/server";
import { MemeCoin, RankShield, TrophyIcon } from "@/components/player/RankBadge";
import { GAME_CONFIG } from "@/config/game.config";
import { progressToNextRank, RANK_REWARDS, rankBounds, rankIndex, RANKS } from "@/config/ranks";

/**
 * Page « Rangs » d'Infos : comment on gagne et perd des trophées, où en est
 * le joueur, et les 10 rangs avec leurs récompenses.
 */
export async function RanksPanel({ trophies, highestRank }: { trophies: number; highestRank: number }) {
  const t = await getTranslations("infos.ranks");
  const tr = await getTranslations("rank");
  const format = await getFormatter();
  const { TROPHIES, MEME_MONEY } = GAME_CONFIG;
  const current = rankIndex(trophies);
  const progress = progressToNextRank(trophies);
  const rules = [
    t("rules.win", { win: TROPHIES.WIN, money: MEME_MONEY.WIN_REWARD }),
    t("rules.loss", { loss: TROPHIES.LOSS }),
    t("rules.draw"),
    t("rules.perRank", { per: format.number(TROPHIES.PER_RANK) }),
    t("rules.drop"),
    t("rules.matchmaking"),
    t("rules.bots"),
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-[1.75rem] border-[3px] border-ink bg-surface p-5 shadow-[0_5px_0_0_var(--mm-shadow)] sm:p-6">
        <div className="flex items-center gap-4">
          <RankShield rank={RANKS[current]} size={56} />
          <div>
            <p className="font-display text-3xl leading-none">
              {t("status", { rank: tr(RANKS[current]), trophies: format.number(trophies) })}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {progress ? t("toNext", { left: format.number(progress.needed - progress.current), rank: tr(progress.next) }) : t("top")}
            </p>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-extrabold">{t("howTitle")}</h3>
          <ul className="mt-2 grid gap-1.5 text-ink-soft sm:grid-cols-2">
            {rules.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden="true" className="text-candy-ink">
                  •
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ol className="grid gap-2">
        {[...RANKS].reverse().map((rank) => {
          const index = RANKS.indexOf(rank);
          const { min, max } = rankBounds(index);
          const reward = RANK_REWARDS[rank];
          const isCurrent = index === current;
          const obtained = index > 0 && index <= highestRank;
          return (
            <li
              key={rank}
              className={`grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 rounded-2xl border-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] ${
                isCurrent ? "border-candy bg-[color-mix(in_srgb,var(--color-candy),transparent_88%)]" : "border-line bg-surface"
              }`}
            >
              <RankShield rank={rank} size={36} />
              <div>
                <p className="flex flex-wrap items-center gap-2 font-extrabold">
                  {tr(rank)}
                  {isCurrent ? (
                    <span className="rounded-full bg-candy px-2 py-0.5 text-xs font-extrabold text-[var(--mm-accent-ink)]">{t("yours")}</span>
                  ) : null}
                </p>
                <p className="flex items-center gap-1 text-sm text-ink-soft">
                  <TrophyIcon size={14} />
                  {max === null
                    ? t("rangeOpen", { min: format.number(min) })
                    : t("range", { min: format.number(min), max: format.number(max) })}
                </p>
              </div>
              <p className="col-span-2 flex flex-wrap items-center gap-2 text-sm font-bold sm:col-span-1 sm:justify-end">
                {index === 0 ? (
                  <span className="text-ink-soft">{t("start")}</span>
                ) : (
                  <>
                    <span>🎁 {t("rewardBoosters", { count: reward.boosters })}</span>
                    <span className="flex items-center gap-1">
                      + <MemeCoin /> {reward.memeMoney}
                    </span>
                    {obtained ? <span className="rounded-full bg-[#d8f5e5] px-2 py-0.5 text-xs text-[#0b5e38]">✓ {t("obtained")}</span> : null}
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
