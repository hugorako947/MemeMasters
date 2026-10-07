import { getFormatter, getTranslations } from "next-intl/server";
import { MemeCoin, RankShield, TrophyIcon } from "@/components/player/RankBadge";
import { TrophyChart } from "@/components/player/TrophyChart";
import { Panel } from "@/components/ui/Panel";
import { progressToNextRank, RANKS, rankFor } from "@/config/ranks";
import type { Player, PublicProfile } from "@/lib/server/players";

/** Profil d'un joueur : rang, statistiques de bataille, progression des trophées. */
export async function ProfileView({ profile, viewer }: { profile: PublicProfile; viewer: Player }) {
  const player = viewer;
  const t = await getTranslations("profile");
  const tr = await getTranslations("rank");
  const format = await getFormatter();
  const isMe = profile.id === player.id;

  const rank = rankFor(profile.trophies);
  const progress = progressToNextRank(profile.trophies);
  const games = profile.wins + profile.losses + profile.draws;
  const pct = (n: number) => (games === 0 ? 0 : n / games);
  const percent = (n: number) => format.number(pct(n), { style: "percent", maximumFractionDigits: 0 });
  const ratio =
    games === 0 ? "—" : profile.losses === 0 ? format.number(profile.wins) : format.number(profile.wins / profile.losses, { maximumFractionDigits: 2 });

  return (
    <div className="grid gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-5xl leading-none break-all">{profile.username}</h1>
          {isMe ? <span className="rounded-full bg-sticker px-3 py-1 text-sm font-bold text-[#1a1238]">{t("you")}</span> : null}
        </div>
        <p className="mt-2 text-ink-soft">
          {t("memberSince", { date: format.dateTime(profile.createdAt, { day: "numeric", month: "long", year: "numeric" }) })}
        </p>
      </header>

      <Panel className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <RankShield rank={rank} size={64} />
        <div>
          <p className="text-sm font-bold text-ink-soft">{t("rank")}</p>
          <p className="flex flex-wrap items-baseline gap-x-3 font-display text-4xl leading-none">
            {tr(rank)}
            <span className="flex items-center gap-1.5 text-2xl">
              <TrophyIcon size={22} />
              {format.number(profile.trophies)}
            </span>
          </p>
          {progress ? (
            <>
              <div className="mm-stat-bar mt-3 border-2 border-ink" aria-hidden="true">
                <span style={{ width: `${(progress.current / progress.needed) * 100}%` }} />
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {t("toNext", { left: progress.needed - progress.current, rank: tr(progress.next) })}
              </p>
            </>
          ) : null}
          <p className="mt-2 text-sm text-ink-soft">
            {t("highest", { rank: tr(RANKS[profile.highestRank]) })}
            {isMe ? (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <MemeCoin className="text-[0.75rem]" /> {t("memeMoney", { amount: player.memeMoney })}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </Panel>

      <Panel className="grid gap-5">
        <h2 className="text-xl font-extrabold">{t("battles")}</h2>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label={t("wins")} value={format.number(profile.wins)} sub={percent(profile.wins)} tone="text-success" />
          <Stat label={t("draws")} value={format.number(profile.draws)} sub={percent(profile.draws)} tone="text-ink-soft" />
          <Stat label={t("losses")} value={format.number(profile.losses)} sub={percent(profile.losses)} tone="text-danger" />
        </dl>
        <div className="mm-keep-colors flex h-4 overflow-hidden rounded-full border-2 border-ink bg-line" aria-hidden="true">
          <span style={{ width: `${pct(profile.wins) * 100}%` }} className="bg-[#12a150]" />
          <span style={{ width: `${pct(profile.draws) * 100}%` }} className="bg-[#b9b4cc]" />
          <span style={{ width: `${pct(profile.losses) * 100}%` }} className="bg-[#e5484d]" />
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("games")} value={format.number(games)} />
          <Stat label={t("ratio")} value={ratio} />
          <Stat label={t("currentStreak")} value={format.number(profile.currentStreak)} />
          <Stat label={t("bestStreak")} value={format.number(profile.bestStreak)} />
        </dl>
      </Panel>

      <Panel className="grid gap-4">
        <h2 className="text-xl font-extrabold">{t("chart.title")}</h2>
        <TrophyChart
          history={profile.history}
          trophies={profile.trophies}
          since={profile.createdAt.toISOString()}
          asOf={profile.asOf}
        />
      </Panel>
    </div>
  );
}

function Stat({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-paper px-2 py-3">
      <dt className="text-xs font-bold text-ink-soft">{label}</dt>
      <dd className={`font-display text-3xl leading-tight ${tone}`}>{value}</dd>
      {sub ? <dd className="text-sm font-bold text-ink-soft">{sub}</dd> : null}
    </div>
  );
}
