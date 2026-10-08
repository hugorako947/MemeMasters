"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { FormMessage } from "@/components/ui/Field";
import { GAME_CONFIG } from "@/config/game.config";
import { postJson } from "@/lib/client/api";
import type { BoosterKind } from "@/lib/economy/boosters";
import { BoosterOpening } from "./BoosterOpening";

export interface BoosterStateView {
  freeLeft: number;
  freePerDay: number;
  dailyReserve: number;
  special: number;
  verySpecial: number;
  memeMoney: number;
}

type Item = "extra" | "special" | "very_special";

/**
 * Case Boosters : le booster journalier à ouvrir tout de suite, les réserves
 * de Super et Ultra Boosters, l'achat en MemeMoney, et un clin d'œil à la Boutique.
 */
export function BoostersPanel({ state, doubleOffer }: { state: BoosterStateView; doubleOffer: boolean }) {
  const t = useTranslations("boostersPanel");
  const th = useTranslations("playerHome");
  const te = useTranslations("errors");
  const router = useRouter();
  const [opening, setOpening] = useState<BoosterKind | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [buying, setBuying] = useState<Item | null>(null);
  const { MEME_MONEY, GAME_NAME, BOOSTER_SIZE } = GAME_CONFIG;
  const dailyAvailable = state.freeLeft + state.dailyReserve;

  const done = useCallback(
    (changed: boolean) => {
      setOpening(null);
      if (changed) router.refresh();
    },
    [router],
  );

  async function buy(item: Item) {
    setBuying(item);
    setMessage(null);
    const res = await postJson("/api/boosters/buy", { item });
    setBuying(null);
    if (res.ok) {
      setMessage({ tone: "success", text: t("bought") });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: te(res.code as "server_error") });
    }
  }

  const rows: Array<{ item: Item; label: string; price: number; owned: number; kind: BoosterKind | null }> = [
    { item: "extra", label: th("boosters.extra"), price: MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE, owned: state.dailyReserve, kind: null },
    { item: "special", label: th("boosters.special"), price: MEME_MONEY.SPECIAL_BOOSTER_PRICE, owned: state.special, kind: "special" },
    { item: "very_special", label: th("boosters.verySpecial"), price: MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE, owned: state.verySpecial, kind: "very_special" },
  ];

  return (
    <div className="grid items-center gap-6 md:grid-cols-[auto_1fr] md:gap-10">
      <div className="grid justify-items-center gap-3">
        <button
          type="button"
          onClick={() => setOpening("daily")}
          disabled={dailyAvailable === 0}
          aria-label={t("openDaily")}
          className="mm-pack-stage w-40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-48"
        >
          <div className="mm-pack mm-pack--hero">
            <span className="mm-pack__tear" aria-hidden="true" />
            <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
            <span className="mm-pack__count">{th("boosters.cards", { count: BOOSTER_SIZE })}</span>
          </div>
        </button>
        <p className="text-center text-sm font-bold">
          {t("freeToday", { left: state.freeLeft, total: state.freePerDay })}
          {state.dailyReserve > 0 ? <span className="text-ink-soft"> · {t("reserve", { count: state.dailyReserve })}</span> : null}
        </p>
        {dailyAvailable > 0 ? (
          <button type="button" onClick={() => setOpening("daily")} className="mm-btn mm-btn--primary px-10">
            {t("open")}
          </button>
        ) : (
          <p className="max-w-56 text-center text-sm text-ink-soft">{t("nextFree")}</p>
        )}
      </div>

      <div className="grid gap-3">
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.item} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border-2 border-[#1a1238] bg-white px-4 py-2.5">
              <span className="font-bold">
                {r.label}
                {r.owned > 0 ? <span className="ms-2 text-sm font-semibold opacity-70">{t("owned", { count: r.owned })}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                {r.kind && r.owned > 0 ? (
                  <button type="button" onClick={() => setOpening(r.kind)} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
                    {t("open")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => buy(r.item)}
                  disabled={buying !== null || state.memeMoney < r.price}
                  className="mm-btn mm-btn--secondary min-h-10 gap-1.5 px-3 text-sm"
                  aria-label={t("buyLabel", { item: r.label, price: r.price })}
                >
                  <MemeCoin />
                  {r.price}
                </button>
              </span>
            </li>
          ))}
        </ul>
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
        <Link
          href="/boutique"
          className="group flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-[#1a1238]/40 px-4 py-2 text-sm font-semibold transition-colors hover:border-[#1a1238] hover:bg-white/70"
        >
          <span className="flex items-center gap-2">
            <MemeCoin />
            {doubleOffer ? th("shop.subtleDouble") : th("shop.subtle")}
          </span>
          <span className="shrink-0 font-extrabold text-candy-ink group-hover:underline">
            {th("shop.cta")} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
          </span>
        </Link>
      </div>
      {opening ? <BoosterOpening kind={opening} onClose={done} /> : null}
    </div>
  );
}
