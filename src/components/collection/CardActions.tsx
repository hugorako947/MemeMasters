"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { duplicatesOf, lookOf, nextUpgrade, sellAllDuplicates, type Level } from "@/lib/economy/duplicates";
import { toast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";
import type { Card } from "@/lib/validation/card";

/**
 * Les boutons posés sur la carte agrandie (le personnage du Battle Royale se choisit depuis la page Battle Royale,
 * bouton « Changer », pour ne pas encombrer la carte) :
 * - Évoluer : niveau suivant et exemplaires nécessaires (« 3 / 5 ») ;
 * - Vendre : tous les exemplaires en trop d'un coup, avec le prix total.
 */
export function CardActions({
  card,
  quantity,
  level,
}: {
  card: Card;
  quantity: number;
  level: Level;
}) {
  const t = useTranslations("dup");
  const errorText = useErrorText();
  const format = useFormatter();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const extra = duplicatesOf(quantity);
  const next = nextUpgrade(card.rarity, level);
  const sale = sellAllDuplicates(card.rarity, quantity);
  const money = (cents: number) => format.number(cents / 100, { maximumFractionDigits: 2 });

  async function run(path: string, body: unknown, success: (d: { level?: Level; cents?: number }) => string) {
    setPending(true);
    setMessage(null);
    const res = await postJson<{ level?: Level; cents?: number }>(path, body);
    setPending(false);
    if (res.ok) {
      setMessage({ ok: true, text: success(res.data) });
      toast.success(success(res.data));
      router.refresh();
    } else {
      setMessage({ ok: false, text: errorText(res.code) });
      toast.error(errorText(res.code));
    }
  }

  return (
    <div className="mm-online-only grid gap-2">
      {next ? (
        <button
          type="button"
          disabled={pending || extra < next.cost}
          onClick={() => run("/api/collection/upgrade", { cardId: card.id }, (d) => t("upgraded", { level: t(`level.${d.level ?? next.to}`) }))}
          className={`mm-btn ${lookOf(next.to) === "divine" ? "mm-btn--divine" : "mm-btn--primary"} min-h-10 w-full justify-between px-3 text-sm`}
        >
          <span>{t("evolveTo", { level: t(`level.${next.to}`) })}</span>
          <span className="font-display text-base">{t("evolveCost", { have: Math.min(extra, next.cost), cost: next.cost })}</span>
        </button>
      ) : (
        <p className="rounded-full bg-paper px-3 py-2 text-center text-sm font-bold">{t("maxed")}</p>
      )}
      <button
        type="button"
        disabled={pending || sale.count === 0}
        onClick={() => run("/api/collection/sell", { lines: [{ cardId: card.id, count: sale.count }] }, (d) => t("sold", { amount: money(d.cents ?? 0) }))}
        className="mm-btn mm-btn--secondary min-h-10 w-full justify-between px-3 text-sm"
      >
        <span>{sale.count > 0 ? t("sellAll", { count: sale.count }) : t("nothingToSellShort")}</span>
        {sale.count > 0 ? (
          <span className="flex items-center gap-1 font-display text-base">
            <MemeCoin /> +{money(sale.cents)}
          </span>
        ) : null}
      </button>
      {message ? (
        <p role="status" className={`text-center text-xs font-bold ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
