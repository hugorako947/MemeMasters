import { getFormatter, getTranslations } from "next-intl/server";
import { TrophyIcon } from "@/components/player/RankBadge";
import { GAME_CONFIG } from "@/config/game.config";
import { InfoList, InfoSection, InfoTable, placeBandRows } from "./InfoBlocks";

/**
 * Page « Trophées » d'Infos : à quoi ils servent, comment on les gagne et les perd en
 * Battle Royale classé (selon la place finale), où on les voit. Valeurs lues dans la configuration.
 */
export async function TrophiesPanel({ trophies }: { trophies: number }) {
  const t = await getTranslations("infos.trophies");
  const format = await getFormatter();
  const { TROPHIES, BATTLE_ROYALE } = GAME_CONFIG;
  const eco = BATTLE_ROYALE.ECONOMY;
  const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
  return (
    <div className="grid gap-5">
      <InfoSection title={t("whatTitle")}>
        <p className="flex items-center gap-3 font-display text-3xl">
          <TrophyIcon size={28} /> {format.number(trophies)}
        </p>
        <p className="text-ink-soft">{t("what")}</p>
      </InfoSection>

      <InfoSection title={t("gainTitle")}>
        <InfoTable head={[t("result"), t("change")]} rows={placeBandRows(eco.TROPHIES_BY_PLACE, (v) => signed(v))} />
        <p className="text-xs text-ink-soft">{t("tableNote", { count: BATTLE_ROYALE.PARTICIPANTS })}</p>
        <InfoList
          items={[
            t("kills", { per: eco.KILL_TROPHY, cap: eco.KILL_TROPHY_CAP }),
            t("rankEffect", { gain: eco.RANK_GAIN_REDUCTION_PERCENT, loss: eco.RANK_LOSS_INCREASE_PERCENT }),
            t("abandon", { penalty: eco.ABANDON_TROPHY_PENALTY }),
            t("floor"),
            t("casual"),
            t("soon"),
          ]}
        />
      </InfoSection>

      <InfoSection title={t("useTitle")}>
        <InfoList items={[t("use1", { per: format.number(TROPHIES.PER_RANK) }), t("use2"), t("use3"), t("use4")]} />
      </InfoSection>

      <InfoSection title={t("whereTitle")}>
        <InfoList items={[t("where1"), t("where2"), t("where3")]} />
      </InfoSection>
    </div>
  );
}
