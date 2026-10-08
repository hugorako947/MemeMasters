/**
 * Boutique de MemeMoney : prix locaux, offres et promotions.
 *
 * Comme sur les boutiques d'applications, chaque pack a un prix « rond » dans
 * chaque devise (pas une conversion au taux du jour). La devise affichée
 * dépend du pays du joueur ; le paiement (phase 5) se fera dans cette devise.
 * Les offres ont de vraies dates : jamais de faux compte à rebours.
 */
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY", "CNY", "BRL", "MXN", "SAR", "AED", "MAD", "XOF"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Prix par pack (dans l'ordre de PURCHASES.PRODUCTS), en unités de la devise. */
export const PRICE_POINTS: Record<Currency, readonly [number, number, number, number]> = {
  EUR: [0.25, 1, 2, 5],
  USD: [0.29, 1.19, 2.29, 5.79],
  GBP: [0.25, 0.89, 1.79, 4.29],
  CHF: [0.25, 0.95, 1.9, 4.9],
  CAD: [0.39, 1.59, 3.19, 7.99],
  JPY: [40, 170, 340, 850],
  CNY: [2, 8, 16, 40],
  BRL: [1.49, 5.99, 11.99, 29.99],
  MXN: [5, 20, 40, 99],
  SAR: [0.99, 4.49, 8.99, 21.99],
  AED: [0.99, 4.49, 8.49, 20.99],
  MAD: [3, 11, 22, 55],
  XOF: [150, 650, 1300, 3300],
};

const EURO_COUNTRIES = [
  "FR", "DE", "ES", "IT", "PT", "BE", "NL", "AT", "IE", "FI", "LU", "GR", "SK", "SI", "EE", "LV", "LT", "MT", "CY",
  "HR", "MC", "AD", "SM", "VA", "ME", "XK", "RE", "GP", "MQ", "GF", "YT", "PM",
];

const COUNTRY_CURRENCY: Record<string, Currency> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR" as const])),
  US: "USD", PR: "USD", EC: "USD", SV: "USD", PA: "USD",
  GB: "GBP", CH: "CHF", LI: "CHF", CA: "CAD", JP: "JPY", CN: "CNY", BR: "BRL", MX: "MXN",
  SA: "SAR", AE: "AED", MA: "MAD",
  SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF", NE: "XOF", TG: "XOF", BJ: "XOF", GW: "XOF",
};

/** Devise affichée pour un pays (ISO 3166-1 alpha-2). Par défaut : le dollar. */
export function currencyForCountry(country: string | null | undefined): Currency {
  if (!country) return "EUR";
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? "USD";
}

export type Offer =
  | {
      code: string;
      kind: "first_purchase_double";
      /** La première recharge du compte rapporte deux fois plus de MemeMoney. */
      startsAt: string | null;
      endsAt: string | null;
    }
  | {
      code: string;
      kind: "discount";
      /** Réduction en % sur certains packs, pendant une période. */
      percent: number;
      productCodes: readonly string[];
      startsAt: string | null;
      endsAt: string | null;
    };

/** Offres actives ou à venir. Modifier les dates ici suffit. */
export const OFFERS: readonly Offer[] = [
  { code: "first_double", kind: "first_purchase_double", startsAt: null, endsAt: null },
  { code: "launch_20", kind: "discount", percent: 20, productCodes: ["mm_200"], startsAt: null, endsAt: "2026-12-31T22:59:59Z" },
];

export function isOfferActive(offer: Offer, now: Date): boolean {
  const t = now.getTime();
  if (offer.startsAt && Date.parse(offer.startsAt) > t) return false;
  if (offer.endsAt && Date.parse(offer.endsAt) < t) return false;
  return true;
}

/** Prix après réduction, arrondi selon la devise (pas de centimes pour le yen ou le franc CFA). */
export function discountedPrice(price: number, percent: number, currency: Currency): number {
  const raw = price * (1 - percent / 100);
  const noDecimals = currency === "JPY" || currency === "XOF";
  return noDecimals ? Math.round(raw) : Math.round(raw * 100) / 100;
}
