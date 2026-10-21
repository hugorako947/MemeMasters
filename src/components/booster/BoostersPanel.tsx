"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactNode } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { toast } from "@/components/ui/Toast";
import { GAME_CONFIG } from "@/config/game.config";
import { RARITIES, type Rarity } from "@/config/rarities";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";
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

const PACK_CLASS: Record<BoosterKind, string> = { daily: "", special: "mm-pack--special", very_special: "mm-pack--ultra" };

/** Meilleure rareté garantie dans un booster (d'après sa composition). */
function guaranteed(kind: BoosterKind): Rarity {
  const fixed = GAME_CONFIG.BOOSTERS[kind].fixed as Partial<Record<Rarity, number>>;
  return [...RARITIES].reverse().find((r) => (fixed[r] ?? 0) > 0) ?? "commune";
}

/**
 * Page Boosters, en trois temps :
 * 1. le grand sachet : combien de boosters t'attendent, et un seul bouton pour les ouvrir ;
 * 2. les boosters spéciaux que tu possèdes (s'il y en a) ;
 * 3. acheter avec ta MemeMoney (solde affiché, prix sur chaque bouton).
 */
export function BoostersPanel({ state, doubleOffer, challenge }: { state: BoosterStateView; doubleOffer: boolean; challenge?: ReactNode }) {
  const t = useTranslations("boostersPanel");
  const th = useTranslations("playerHome");
  const tr = useTranslations("rarity");
  const errorText = useErrorText();
  const router = useRouter();
  const [opening, setOpening] = useState<BoosterKind | null>(null);
  const { MEME_MONEY, GAME_NAME, BOOSTER_SIZE } = GAME_CONFIG;
  const dailyAvailable = state.freeLeft + state.dailyReserve;

  const done = useCallback(
    (changed: boolean) => {
      setOpening(null);
      if (changed) router.refresh();
    },
    [router],
  );

  async function buy(item: Item, label: string) {
    const res = await postJson("/api/boosters/buy", { item });
    if (res.ok) {
      toast.success(t("boughtItem", { item: label }));
      router.refresh();
    } else {
      toast.error(errorText(res.code));
    }
  }

  const specials: Array<{ kind: BoosterKind; label: string; owned: number }> = [
    { kind: "special", label: th("boosters.special"), owned: state.special },
    { kind: "very_special", label: th("boosters.verySpecial"), owned: state.verySpecial },
  ];
  const shop: Array<{ item: Item; kind: BoosterKind; label: string; price: number }> = [
    { item: "extra", kind: "daily", label: th("boosters.extra"), price: MEME_MONEY.EXTRA_DAILY_BOOSTER_PRICE },
    { item: "special", kind: "special", label: th("boosters.special"), price: MEME_MONEY.SPECIAL_BOOSTER_PRICE },
    { item: "very_special", kind: "very_special", label: th("boosters.verySpecial"), price: MEME_MONEY.VERY_SPECIAL_BOOSTER_PRICE },
  ];

  return (
    <div className="grid gap-6">
      {/* 1. Le booster du jour : l'action principale. */}
      <section className="mm-online-only grid items-center justify-items-center gap-5 text-center sm:grid-cols-[auto_1fr] sm:justify-items-start sm:text-start">
        <button
          type="button"
          onClick={() => setOpening("daily")}
          disabled={dailyAvailable === 0}
          aria-label={t("openDaily")}
          className="mm-pack-stage w-36 disabled:cursor-not-allowed disabled:opacity-60 sm:w-44"
        >
          <div className="mm-pack mm-pack--hero">
            <span className="mm-pack__tear" aria-hidden="true" />
            <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
            <span className="mm-pack__count">{th("boosters.cards", { count: BOOSTER_SIZE })}</span>
          </div>
        </button>
        <div className="grid gap-3">
          <p className="flex items-baseline justify-center gap-2 sm:justify-start">
            <span className="font-display text-6xl leading-none">{dailyAvailable}</span>
            <span className="text-lg font-extrabold">{t("available", { count: dailyAvailable })}</span>
          </p>
          <p className="text-sm font-semibold opacity-80">
            {t("freeToday", { left: state.freeLeft, total: state.freePerDay })}
            {state.dailyReserve > 0 ? ` · ${t("reserve", { count: state.dailyReserve })}` : ""}
          </p>
          {dailyAvailable > 0 ? (
            <button type="button" onClick={() => setOpening("daily")} className="mm-btn mm-btn--primary justify-self-center px-10 sm:justify-self-start">
              {t("openOne")}
            </button>
          ) : (
            <p className="rounded-xl bg-white/70 px-4 py-2 text-sm font-bold">{t("nextFree")}</p>
          )}
        </div>
      </section>

      {challenge}

      {/* 2. Boosters spéciaux possédés : affichés seulement s'il y en a. */}
      {specials.some((s) => s.owned > 0) ? (
        <section className="mm-online-only grid gap-2" aria-labelledby="mes-boosters">
          <h3 id="mes-boosters" className="font-display text-2xl leading-none">
            {t("mineTitle")}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {specials
              .filter((s) => s.owned > 0)
              .map((s) => (
                <li key={s.kind}>
                  <button type="button" onClick={() => setOpening(s.kind)} className="mm-btn mm-btn--primary min-h-11 gap-2 px-4 text-sm">
                    {t("openKind", { item: s.label })}
                    <span className="rounded-full bg-white/80 px-2 text-xs text-[#1a1238]">×{s.owned}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {/* 3. Acheter avec la MemeMoney. */}
      <section className="mm-online-only grid gap-3" aria-labelledby="acheter-boosters">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="acheter-boosters" className="font-display text-2xl leading-none">
            {t("buyTitle")}
          </h3>
          <span className="flex items-center gap-1.5 rounded-full border-2 border-[#1a1238] bg-white px-3 py-1 text-sm font-extrabold">
            <MemeCoin /> {t("balance", { amount: state.memeMoney })}
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {shop.map((s) => {
            const affordable = state.memeMoney >= s.price;
            return (
              <li key={s.item} className="grid grid-cols-[3rem_1fr] items-center gap-3 rounded-2xl border-2 border-[#1a1238] bg-white p-3 sm:grid-cols-1 sm:justify-items-center sm:text-center">
                <div className={`mm-pack ${PACK_CLASS[s.kind]} w-12 sm:w-14`} aria-hidden="true" />
                <div className="grid gap-2 sm:justify-items-center">
                  <div>
                    <p className="font-extrabold leading-tight">{s.label}</p>
                    <p className="text-xs opacity-75">{t("guaranteed", { rarity: tr(guaranteed(s.kind)) })}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(s.item, s.label)}
                    disabled={!affordable}
                    className="mm-btn mm-btn--secondary min-h-10 justify-self-start gap-1.5 px-4 text-sm sm:justify-self-center"
                    aria-label={t("buyLabel", { item: s.label, price: s.price })}
                  >
                    <MemeCoin /> {s.price}
                  </button>
                  {!affordable ? <p className="text-xs font-semibold opacity-75">{t("missing", { amount: s.price - state.memeMoney })}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/boutique" className="group justify-self-center text-sm font-semibold sm:justify-self-end">
          {doubleOffer ? th("shop.subtleDouble") : th("shop.subtle")}{" "}
          <span className="font-extrabold text-candy-ink group-hover:underline">
            {th("shop.cta")} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
          </span>
        </Link>
      </section>
      {opening ? <BoosterOpening kind={opening} onClose={done} /> : null}
    </div>
  );
}
