"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { FormMessage } from "@/components/ui/Field";
import { countsTowardCap, duplicatesOf, maxSellable, nextUpgrade, sellValueCents, type Variant } from "@/lib/economy/duplicates";
import { postJson } from "@/lib/client/api";
import type { Card } from "@/lib/validation/card";

/**
 * Dans la fiche d'une carte possédée : améliorer (Dorée, Divine) ou revendre.
 */
export function DuplicateActions({
  card,
  quantity,
  variant,
  resaleLeftCents,
}: {
  card: Card;
  quantity: number;
  variant: Variant;
  resaleLeftCents: number;
}) {
  const t = useTranslations("dup");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const dups = duplicatesOf(quantity);
  const upgrade = nextUpgrade(variant);
  const capped = countsTowardCap(card.rarity);
  const maxBySell = maxSellable(quantity, variant);
  const unit = sellValueCents(card.rarity, 1);
  const maxByCap = capped ? Math.floor(resaleLeftCents / unit) : Number.POSITIVE_INFINITY;
  const max = Math.min(maxBySell, maxByCap);
  const [count, setCount] = useState(1);
  // Vendre le dernier exemplaire retire la carte de la collection : on demande une confirmation.
  const [confirmLast, setConfirmLast] = useState(false);
  const n = Math.min(Math.max(1, count), Math.max(1, max));
  const money = (cents: number) => format.number(cents / 100, { maximumFractionDigits: 2 });

  async function run(path: string, body: unknown, success: (data: { variant?: Variant; cents?: number }) => string) {
    setPending(true);
    setMessage(null);
    const res = await postJson<{ variant?: Variant; cents?: number }>(path, body);
    setPending(false);
    if (res.ok) {
      setMessage({ tone: "success", text: success(res.data) });
      setCount(1);
      setConfirmLast(false);
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
        <span className="rounded-full bg-paper px-3 py-1 text-sm">{t(`variant.${variant}`)}</span>
      </p>

      {/* Amélioration */}
      {upgrade ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-sm font-bold">
            <span>{t("upgradeTo", { variant: t(`variant.${upgrade.to}`) })}</span>
            <span className="text-ink-soft">{t("upgradeCost", { have: Math.min(dups, upgrade.cost), cost: upgrade.cost })}</span>
          </div>
          <div className="mm-stat-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (dups / upgrade.cost) * 100)}%`, ["--bar" as string]: upgrade.to === "gold" ? "#f5b400" : "#9aa7c7" }} />
          </div>
          <button
            type="button"
            disabled={pending || dups < upgrade.cost}
            onClick={() => run("/api/collection/upgrade", { cardId: card.id }, (d) => t("upgraded", { variant: t(`variant.${d.variant ?? upgrade.to}`) }))}
            className={`mm-btn ${upgrade.to === "gold" ? "mm-btn--gold" : "mm-btn--divine"} min-h-11 text-sm`}
          >
            ✨ {t("upgradeTo", { variant: t(`variant.${upgrade.to}`) })}
          </button>
        </div>
      ) : (
        <p className="text-sm font-bold">✨ {t("maxed")}</p>
      )}

      {/* Revente */}
      <div className="grid gap-2 border-t-2 border-dashed border-line pt-3">
        <p className="text-sm text-ink-soft">{variant === "normal" ? t("canSellAll") : t("keepLast")}</p>
        {max > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full border-2 border-ink bg-surface" role="group" aria-label={t("sellCount")}>
              <button type="button" onClick={() => { setCount(n - 1); setConfirmLast(false); }} disabled={n <= 1} className="grid size-10 place-items-center text-xl font-bold disabled:opacity-40" aria-label={t("less")}>
                −
              </button>
              <span className="min-w-8 text-center font-display text-xl" aria-live="polite">
                {n}
              </span>
              <button type="button" onClick={() => { setCount(n + 1); setConfirmLast(false); }} disabled={n >= max} className="grid size-10 place-items-center text-xl font-bold disabled:opacity-40" aria-label={t("more")}>
                +
              </button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (n === quantity && !confirmLast) {
                  setConfirmLast(true);
                  return;
                }
                run("/api/collection/sell", { lines: [{ cardId: card.id, count: n }] }, (d) => t("sold", { amount: money(d.cents ?? 0) }));
              }}
              className={`mm-btn ${confirmLast ? "mm-btn--danger" : "mm-btn--secondary"} min-h-11 flex-1 gap-1.5 text-sm`}
            >
              {confirmLast ? t("confirmLast") : t("sell")} · <MemeCoin /> +{money(unit * n)}
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold">{maxBySell > 0 && capped ? t("capReached") : t("nothingToSell")}</p>
        )}
        {confirmLast ? <p className="text-sm font-bold text-danger">{t("lastWarning")}</p> : null}
        {capped ? <p className="text-xs text-ink-soft">{t("capLeft", { amount: money(resaleLeftCents) })}</p> : null}
      </div>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
    </section>
  );
}
