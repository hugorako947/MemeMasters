import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { RarityOdds } from "@/components/card/RarityOdds";
import { sampleOf } from "@/components/card/sample-cards";
import { AdaptiveShell } from "@/components/layout/AdaptiveShell";
import { RARITIES } from "@/config/rarities";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rarities");
  return { title: t("title") };
}

/** Vitrine publique du design system : les 8 raretés sur des cartes réelles. */
export default async function RaritiesPage() {
  const t = await getTranslations("rarities");
  return (
    <AdaptiveShell>
      <h1 className="font-display text-5xl leading-none md:text-6xl">{t("title")}</h1>
      <ol className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {RARITIES.map(sampleOf).map((card) => (
          <li key={card.id} className="mx-auto w-full max-w-[18.5rem]">
            <InteractiveCard card={card} />
            <p className="mt-4 text-center text-sm font-semibold text-ink-soft">
              <RarityOdds rarity={card.rarity} />
            </p>
          </li>
        ))}
      </ol>
    </AdaptiveShell>
  );
}
