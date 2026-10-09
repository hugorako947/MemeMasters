import { getFormatter, getTranslations } from "next-intl/server";
import { MemeCoin } from "@/components/player/RankBadge";
import { GAME_CONFIG } from "@/config/game.config";
import { RANK_REWARDS, RANKS } from "@/config/ranks";
import { OFFERS, isOfferActive } from "@/config/shop";
import { InfoList, InfoSection, InfoTable } from "./InfoBlocks";

/** Page « MemeMoney » d'Infos : ce que c'est, comment en gagner, comment la dépenser, et ses règles. */
export async function MemeMoneyPanel() {
  const t = await getTranslations("infos.memeMoney");
  const th = await getTranslations("playerHome.boosters");
  const format = await getFormatter();
  const { MEME_MONEY, DUPLICATES, PURCHASES } = GAME_CONFIG;
  const rankTotal = RANKS.reduce((n, r) => n + RANK_REWARDS[r].memeMoney, 0);
  const firstDouble = OFFERS.some((o) => o.kind === "first_purchase_double" && isOfferActive(o, new Date()));
  const cheapest = format.number(Math.min(...PURCHASES.PRODUCTS.map((p) => p.priceCents)) / 100, { style: "currency", currency: "EUR" });
  return (
    <div className="grid gap-5">
      <InfoSection title={t("whatTitle")}>
        <p className="flex items-center gap-3 text-ink-soft">
          <span className="text-3xl">
            <MemeCoin />
          </span>
          {t("what")}
        </p>
      </InfoSection>

      <InfoSection title={t("earnTitle")}>
        <InfoList
          items={[
            t("earnWin", { amount: MEME_MONEY.WIN_REWARD }),
            t("earnRanks", { total: format.number(rankTotal) }),
            t("earnSell", { cap: DUPLICATES.DAILY_SELL_CAP }),
            t("earnShop", { price: cheapest }),
            ...(firstDouble ? [t("earnFirst")] : []),
          ]}
        />
      </InfoSection>

      <InfoSection title={t("spendTitle")}>
        <InfoTable
          head={[t("item"), t("price")]}
          rows={[
            [th("extra"), `${MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE} MemeMoney`],
            [th("special"), `${MEME_MONEY.SPECIAL_BOOSTER_PRICE} MemeMoney`],
            [th("verySpecial"), `${MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE} MemeMoney`],
          ]}
        />
        <p className="text-sm text-ink-soft">{t("spendWhere")}</p>
      </InfoSection>

      <InfoSection title={t("rulesTitle")}>
        <InfoList
          items={[
            t("rule1"),
            t("rule2"),
            t("rule3"),
            t("rule4", { age: PURCHASES.MIN_AGE, cap: format.number(PURCHASES.MONTHLY_SPEND_CAP_CENTS / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) }),
          ]}
        />
      </InfoSection>
    </div>
  );
}
