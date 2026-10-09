"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { FormMessage } from "@/components/ui/Field";
import { GAME_CONFIG } from "@/config/game.config";
import { countsTowardCap, duplicatesOf, lookOf, nextUpgrade, sellAllDuplicates, type Level } from "@/lib/economy/duplicates";
import { postJson } from "@/lib/client/api";
import type { Card } from "@/lib/validation/card";

/**
 * Dans la fiche d'une carte possédée : améliorer (Dorée ★, ★★, Divine ★★★) ou revendre
 * d'un coup tous les exemplaires en trop (« Revendre ×2 »). Le premier
 * exemplaire reste toujours dans la collection.
 */
export function DuplicateActions({
  card,
  quantity,
  level,
  resaleLeftCents,
}: {
  card: Card;
  quantity: number;
  level: Level;
  resaleLeftCents: number;
}) {
  const t = useTranslations("dup");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const dups = duplicatesOf(quantity);
  const upgrade = nextUpgrade(card.rarity, level);
  const capped = countsTowardCap(card.rarity);
  const sale = sellAllDuplicates(card.rarity, quantity, resaleLeftCents);
  const money = (cents: number) => format.number(cents / 100, { maximumFractionDigits: 2 });

  async function run(path: string, body: unknown, success: (data: { level?: Level; cents?: number }) => string) {
    setPending(true);
    setMessage(null);
    const res = await postJson<{ level?: Level; cents?: number }>(path, body);
    setPending(false);
    if (res.ok) {
      setMessage({ tone: "success", text: success(res.data) });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: te(res.code as "server_error") });
    }
  }

  if (quantity <= 0) return null;

  return (
    <section className="grid gap-4 rounded-2xl border-2 border-ink bg-surface p-4">
      <p className="flex flex-wrap items-center justify-between gap-2 font-extrabold">
        <span>{t("owned", { count: quantity, dups })}</span>
        <span className="rounded-full bg-paper px-3 py-1 text-sm">{t(`level.${level}`)}</span>
      </p>

      {/* Amélioration */}
      {upgrade ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-sm font-bold">
            <span>{t("upgradeTo", { level: t(`level.${upgrade.to}`), percent: GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT[upgrade.to] })}</span>
            <span className="text-ink-soft">{t("upgradeCost", { have: Math.min(dups, upgrade.cost), cost: upgrade.cost })}</span>
          </div>
          <div className="mm-stat-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (dups / upgrade.cost) * 100)}%`, ["--bar" as string]: lookOf(upgrade.to) === "gold" ? "#f5b400" : "#9aa7c7" }} />
          </div>
          <button
            type="button"
            disabled={pending || dups < upgrade.cost}
            onClick={() => run("/api/collection/upgrade", { cardId: card.id }, (d) => t("upgraded", { level: t(`level.${d.level ?? upgrade.to}`) }))}
            className={`mm-btn ${lookOf(upgrade.to) === "gold" ? "mm-btn--gold" : "mm-btn--divine"} min-h-11 text-sm`}
          >
            {t("upgradeButton", { level: t(`level.${upgrade.to}`) })}
          </button>
        </div>
      ) : (
        <p className="text-sm font-bold">{t("maxed")}</p>
      )}

      {/* Revente : tous les exemplaires en trop d'un coup ; la carte reste dans la collection. */}
      <div className="grid gap-2 border-t-2 border-dashed border-line pt-3">
        {sale.count > 0 ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("/api/collection/sell", { lines: [{ cardId: card.id, count: sale.count }] }, (d) => t("sold", { amount: money(d.cents ?? 0) }))}
              className="mm-btn mm-btn--secondary min-h-11 gap-1.5 text-sm"
            >
              {t("sellAll", { count: sale.count })} · <MemeCoin /> +{money(sale.cents)}
            </button>
            {sale.limited ? <p className="text-xs font-semibold text-ink-soft">{t("capPartial", { count: sale.count, total: dups })}</p> : null}
          </>
        ) : (
          <p className="text-sm font-semibold">{dups > 0 && capped ? t("capReached") : t("nothingToSell")}</p>
        )}
        {capped && dups > 0 ? <p className="text-xs text-ink-soft">{t("capLeft", { amount: money(resaleLeftCents) })}</p> : null}
      </div>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
    </section>
  );
}
