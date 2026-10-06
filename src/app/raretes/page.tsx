import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { SAMPLE_CARDS } from "@/components/card/sample-cards";
import { PublicShell } from "@/components/layout/PublicShell";
import { GAME_CONFIG } from "@/config/game.config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rarities");
  return { title: t("title") };
}

/** Vitrine publique du design system : les 8 raretés sur des cartes réelles. */
export default async function RaritiesPage() {
  const t = await getTranslations("rarities");
  const tr = await getTranslations("rarity");
  const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  return (
    <PublicShell>
      <h1 className="font-display text-5xl leading-none md:text-6xl">{t("title")}</h1>
      <p className="mt-3 max-w-prose text-ink-soft">{t("lead")}</p>
      <ol className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {SAMPLE_CARDS.map((card) => (
          <li key={card.id} className="mx-auto w-full max-w-[18.5rem]">
            <InteractiveCard card={card} />
            <p className="mt-4 flex items-baseline justify-between gap-2">
              <span className="font-bold">{tr(card.rarity)}</span>
              <span className="text-sm text-ink-soft">
                {t("dropRate", { rate: fmt.format(GAME_CONFIG.DROP_RATES[card.rarity]) })}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </PublicShell>
  );
}
