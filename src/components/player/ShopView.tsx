import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MemeCoin } from "@/components/player/RankBadge";
import { Panel } from "@/components/ui/Panel";
import { GAME_CONFIG } from "@/config/game.config";
import { currencyForCountry, discountedPrice, isOfferActive, OFFERS, PRICE_POINTS } from "@/config/shop";

/** MemeMoney du premier pack concerné par une réduction (affiché dans le texte de l'offre). */
function discountedPackAmount(codes: readonly string[]): number {
  const product = GAME_CONFIG.PURCHASES.PRODUCTS.find((p) => codes.includes(p.code));
  return product ? product.memeMoney + product.bonus : 0;
}

/**
 * Boutique : uniquement des packs de MemeMoney en argent réel, avec leurs
 * offres. Les boosters en plus, Super Boosters et Ultra Boosters s'achètent en
 * MemeMoney depuis la case Boosters de l'accueil, pas ici.
 * Le paiement (Stripe) arrive en phase 5 : les boutons sont désactivés.
 */
export async function ShopView({ country, hasPurchased }: { country: string | null; hasPurchased: boolean }) {
  const t = await getTranslations("shop");
  const format = await getFormatter();
  const blocked = country ? GAME_CONFIG.PURCHASES.BLOCKED_COUNTRIES.includes(country.toUpperCase()) : false;
  const currency = currencyForCountry(country);
  const prices = PRICE_POINTS[currency];
  const now = new Date();
  const active = OFFERS.filter((o) => isOfferActive(o, now));
  const firstDouble = active.some((o) => o.kind === "first_purchase_double") && !hasPurchased;
  const money = (n: number) => format.number(n, { style: "currency", currency });

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-5xl leading-none">{t("title")}</h1>

      {blocked ? (
        <Panel>
          <p className="font-semibold">{t("blocked")}</p>
        </Panel>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {firstDouble ? (
                <li className="rounded-2xl border-2 border-ink bg-sticker p-4 text-[#1a1238] shadow-[0_3px_0_0_var(--mm-shadow)]">
                  <p className="font-display text-2xl leading-none">{t("offers.firstDouble.title")}</p>
                  <p className="mt-1 text-sm font-semibold">{t("offers.firstDouble.text")}</p>
                </li>
              ) : null}
              {active
                .filter((o) => o.kind === "discount")
                .map((o) => (
                  <li key={o.code} className="rounded-2xl border-2 border-ink bg-candy p-4 text-[var(--mm-accent-ink)] shadow-[0_3px_0_0_var(--mm-shadow)]">
                    <p className="font-display text-2xl leading-none">{t("offers.discount.title", { percent: o.kind === "discount" ? o.percent : 0 })}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {o.endsAt
                        ? t("offers.discount.until", {
                            date: format.dateTime(new Date(o.endsAt), { day: "numeric", month: "long" }),
                            amount: discountedPackAmount(o.kind === "discount" ? o.productCodes : []),
                          })
                        : t("offers.discount.limited")}
                    </p>
                  </li>
                ))}
            </ul>
          ) : null}

          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {GAME_CONFIG.PURCHASES.PRODUCTS.map((product, i) => {
              const discount = active.find((o) => o.kind === "discount" && o.productCodes.includes(product.code));
              const base = prices[i];
              const price = discount && discount.kind === "discount" ? discountedPrice(base, discount.percent, currency) : base;
              const total = product.memeMoney + product.bonus;
              return (
                <li
                  key={product.code}
                  className={`relative flex flex-col items-center gap-3 rounded-[1.5rem] border-2 bg-surface p-4 pt-6 text-center shadow-[0_3px_0_0_var(--mm-shadow)] ${
                    product.tag ? "border-candy" : "border-ink"
                  }`}
                >
                  {product.tag ? (
                    <span className="absolute -top-3.5 rounded-full border-2 border-ink bg-candy px-3 py-0.5 text-xs font-extrabold text-[var(--mm-accent-ink)]">
                      {t(`tags.${product.tag}`)}
                    </span>
                  ) : null}
                  <span className="mm-coin-stack" style={{ fontSize: `${1.4 + i * 0.35}rem` }} aria-hidden="true">
                    {Array.from({ length: i + 1 }, (_, k) => (
                      <MemeCoin key={k} />
                    ))}
                  </span>
                  <p className="font-display text-4xl leading-none">{format.number(total)}</p>
                  <p className="-mt-2 text-xs font-bold text-ink-soft">MemeMoney</p>
                  <div className="min-h-6">
                    {product.bonus > 0 ? (
                      <span className="rounded-full bg-[#d8f5e5] px-2.5 py-1 text-xs font-extrabold text-[#0b5e38]">
                        {t("bonus", { amount: product.bonus })}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-auto">
                    {price !== base ? <span className="me-2 text-sm text-ink-soft line-through">{money(base)}</span> : null}
                    <span className="font-display text-2xl">{money(price)}</span>
                  </p>
                  <button type="button" disabled className="mm-btn mm-btn--primary w-full text-sm" title={t("soon")}>
                    {t("buy")}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-center text-sm font-semibold text-ink-soft">{t("soon")}</p>
        </>
      )}

      <Panel className="grid gap-1.5 text-sm text-ink-soft">
        <p>{t("notes.adults")}</p>
        <p>{t("notes.cap", { amount: format.number(GAME_CONFIG.PURCHASES.MONTHLY_SPEND_CAP_CENTS / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) })}</p>
        <p>{t("notes.value")}</p>
        <p>
          {t("notes.boosters")}{" "}
          <Link href="/conditions-utilisation" className="font-semibold text-link underline underline-offset-4">
            {t("notes.terms")}
          </Link>
        </p>
      </Panel>
    </div>
  );
}
