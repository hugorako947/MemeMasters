"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactNode } from "react";
import { MemeCoin } from "@/components/player/RankBadge";
import { toast } from "@/components/ui/Toast";
import { GAME_CONFIG } from "@/config/game.config";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";
import type { BoosterKind } from "@/lib/economy/boosters";
import { BoosterOpening, type OpenedBooster } from "./BoosterOpening";

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

/**
 * Page Boosters :
 * 1. le sachet du jour, au centre : un clic l'ouvre directement (les 10 cartes s'affichent) ;
 * 2. le défi du jour ;
 * 3. les boosters spéciaux possédés (s'il y en a), ouverts eux aussi d'un clic ;
 * 4. l'achat en MemeMoney (le solde est déjà affiché en haut de l'écran) et la Boutique.
 */
export function BoostersPanel({ state, doubleOffer, challenge }: { state: BoosterStateView; doubleOffer: boolean; challenge?: ReactNode }) {
  const t = useTranslations("boostersPanel");
  const th = useTranslations("playerHome");
  const errorText = useErrorText();
  const router = useRouter();
  const [opened, setOpened] = useState<OpenedBooster | null>(null);
  const { MEME_MONEY, GAME_NAME, BOOSTER_SIZE } = GAME_CONFIG;
  const dailyAvailable = state.freeLeft + state.dailyReserve;

  // Le tirage est fait par le serveur ; pendant ce temps, le sachet (ou le bouton) tourne.
  async function open(kind: BoosterKind) {
    const res = await postJson<Omit<OpenedBooster, "kind">>("/api/boosters/open", { kind });
    if (!res.ok) {
      toast.error(errorText(res.code));
      return;
    }
    setOpened({ kind, cards: res.data.cards, newCardIds: res.data.newCardIds });
  }

  const close = useCallback(() => {
    setOpened(null);
    router.refresh();
  }, [router]);

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
      {/* 1. Le booster du jour, au centre : un seul clic suffit pour l'ouvrir. */}
      <section className="mm-online-only grid justify-items-center gap-3 text-center">
        <button
          type="button"
          onClick={() => open("daily")}
          disabled={dailyAvailable === 0}
          aria-label={t("openDaily")}
          data-mm-busy-style="overlay"
          className="mm-pack-stage w-40 rounded-xl disabled:cursor-not-allowed disabled:opacity-60 sm:w-48"
        >
          <div className="mm-pack mm-pack--hero">
            <span className="mm-pack__tear" aria-hidden="true" />
            <span className="mm-pack__label meme-caption">{GAME_NAME}</span>
            <span className="mm-pack__count">{th("boosters.cards", { count: BOOSTER_SIZE })}</span>
          </div>
        </button>
        <p className="text-lg font-extrabold">{t("freeLeft", { count: state.freeLeft })}</p>
        {state.dailyReserve > 0 ? <p className="-mt-2 text-sm font-semibold opacity-80">{t("reserve", { count: state.dailyReserve })}</p> : null}
        {dailyAvailable === 0 ? <p className="rounded-xl border-2 border-ink bg-surface px-4 py-2 text-sm font-bold">{t("nextFree")}</p> : null}
      </section>

      {challenge}

      {/* 2. Boosters spéciaux possédés : affichés seulement s'il y en a, ouverts d'un clic. */}
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
                  <button type="button" onClick={() => open(s.kind)} className="mm-btn mm-btn--primary min-h-11 gap-2 px-4 text-sm">
                    {t("openKind", { item: s.label })}
                    <span className="rounded-full bg-surface px-2 text-xs text-ink">×{s.owned}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {/* 3. Acheter avec la MemeMoney : le prix est sur chaque bouton. */}
      <ul className="mm-online-only grid gap-3 sm:grid-cols-3">
        {shop.map((s) => (
          <li key={s.item} className="grid grid-cols-[3rem_1fr] items-center gap-3 rounded-2xl border-2 border-ink bg-surface p-3 sm:grid-cols-1 sm:justify-items-center sm:text-center">
            <div className={`mm-pack ${PACK_CLASS[s.kind]} w-12 sm:w-14`} aria-hidden="true" />
            <div className="grid gap-2 sm:justify-items-center">
              <p className="font-extrabold leading-tight">{s.label}</p>
              <button
                type="button"
                onClick={() => buy(s.item, s.label)}
                disabled={state.memeMoney < s.price}
                className="mm-btn mm-btn--secondary min-h-11 justify-self-start gap-1.5 px-4 text-sm sm:justify-self-center"
                aria-label={t("buyLabel", { item: s.label, price: s.price })}
              >
                <MemeCoin /> {s.price}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* 4. La Boutique : une vraie case, avec l'offre de la première recharge. */}
      <Link
        href="/boutique"
        className="mm-online-only mm-shop-promo group grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border-2 border-ink p-4 text-ink shadow-[0_3px_0_0_var(--mm-shadow)] transition-transform hover:-translate-y-0.5 sm:grid-cols-[auto_1fr_auto]"
      >
        <span className="grid place-items-center text-[2.6rem] leading-none">
          <MemeCoin />
        </span>
        <span className="grid gap-0.5">
          {doubleOffer ? (
            <span className="justify-self-start rounded-full bg-ink px-2.5 py-0.5 text-xs font-extrabold text-paper">{t("shopBadge")}</span>
          ) : null}
          <span className="font-display text-2xl leading-tight">{doubleOffer ? t("shopTitleDouble") : t("shopTitle")}</span>
          <span className="text-sm font-semibold text-ink-soft">{t("shopLead")}</span>
        </span>
        <span className="col-span-2 justify-self-start rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm font-extrabold group-hover:underline sm:col-span-1">
          {t("shopCta")} <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
        </span>
      </Link>

      {opened ? <BoosterOpening opened={opened} onClose={close} /> : null}
    </div>
  );
}
