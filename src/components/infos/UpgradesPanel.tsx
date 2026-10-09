import { getFormatter, getTranslations } from "next-intl/server";
import { MemeCard } from "@/components/card/MemeCard";
import { sampleOf } from "@/components/card/sample-cards";
import { GAME_CONFIG } from "@/config/game.config";
import { RARITIES } from "@/config/rarities";
import { LEVELS } from "@/lib/economy/duplicates";
import { InfoList, InfoSection, InfoTable } from "./InfoBlocks";

/** Page « Améliorations » d'Infos : niveaux étoilés, coûts, bonus et revente des exemplaires en trop. */
export async function UpgradesPanel() {
  const t = await getTranslations("infos.upgrades");
  const tr = await getTranslations("rarity");
  const tl = await getTranslations("dup.level");
  const format = await getFormatter();
  const { UPGRADES, STAT_BONUS_PERCENT, SELL_CENTS, DAILY_SELL_CAP } = GAME_CONFIG.DUPLICATES;
  const demo = sampleOf("rare");
  const money = (cents: number) => format.number(cents / 100, { maximumFractionDigits: 2 });
  return (
    <div className="grid gap-5">
      <InfoSection title={t("levelsTitle")}>
        <p className="text-ink-soft">{t("lead")}</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVELS.map((level) => (
            <li key={level} className="grid gap-2 text-center">
              <MemeCard card={demo} size="compact" level={level} />
              <p className="text-sm font-extrabold">{tl(String(level) as "0")}</p>
              <p className="text-xs text-ink-soft">{level === 0 ? t("base") : t("bonus", { percent: STAT_BONUS_PERCENT[level] })}</p>
            </li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection title={t("howTitle")}>
        <InfoList items={[t("how1"), t("how2"), t("how3"), t("how4", { max: STAT_BONUS_PERCENT[3] }), t("how5")]} />
      </InfoSection>

      <InfoSection title={t("costTitle")}>
        <InfoTable
          head={[t("rarity"), tl("1"), tl("2"), tl("3")]}
          rows={RARITIES.map((r) => [tr(r), ...UPGRADES[r].map((n) => t("copies", { count: n }))])}
        />
      </InfoSection>

      <InfoSection title={t("sellTitle")}>
        <InfoList items={[t("sell1"), t("sell2"), t("sell3", { cap: DAILY_SELL_CAP }), t("sell4")]} />
        <InfoTable head={[t("rarity"), t("sellPrice")]} rows={RARITIES.map((r) => [tr(r), `${money(SELL_CENTS[r])} MemeMoney`])} />
      </InfoSection>
    </div>
  );
}
