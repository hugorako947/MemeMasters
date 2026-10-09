import { getFormatter, getTranslations } from "next-intl/server";
import { TrophyIcon } from "@/components/player/RankBadge";
import { GAME_CONFIG } from "@/config/game.config";
import { InfoList, InfoSection, InfoTable } from "./InfoBlocks";

/** Page « Trophées » d'Infos : à quoi ils servent, comment on les gagne et les perd, où on les voit. */
export async function TrophiesPanel({ trophies }: { trophies: number }) {
  const t = await getTranslations("infos.trophies");
  const format = await getFormatter();
  const { TROPHIES } = GAME_CONFIG;
  return (
    <div className="grid gap-5">
      <InfoSection title={t("whatTitle")}>
        <p className="flex items-center gap-3 font-display text-3xl">
          <TrophyIcon size={28} /> {format.number(trophies)}
        </p>
        <p className="text-ink-soft">{t("what")}</p>
      </InfoSection>

      <InfoSection title={t("gainTitle")}>
        <InfoTable
          head={[t("result"), t("change")]}
          rows={[
            [t("win"), `+${TROPHIES.WIN}`],
            [t("draw"), "0"],
            [t("loss"), `−${TROPHIES.LOSS}`],
          ]}
        />
        <InfoList items={[t("floor"), t("bots"), t("soon")]} />
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
