import { getTranslations } from "next-intl/server";
import { RARITIES, RARITY_GLYPH } from "@/config/rarities";
import { InteractiveCard } from "./InteractiveCard";
import { RarityOdds } from "./RarityOdds";
import { sampleOf } from "./sample-cards";

/**
 * Les 8 raretés sur un panneau sombre où les cartes brillent.
 * Mobile : carrousel horizontal. Grand écran : colonne latérale en quinconce.
 * De la plus rare à la plus courante : la Godlevel accroche l'œil en premier.
 */
export async function RarityShowcase({ className = "" }: { className?: string }) {
  const t = await getTranslations("showcase");
  const tr = await getTranslations("rarity");
  const cards = [...RARITIES].reverse().map(sampleOf);

  return (
    <aside
      aria-labelledby="raretes-titre"
      className={`relative overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-[var(--mm-night)] p-5 text-white shadow-[0_6px_0_0_var(--color-candy)] ${className}`}
    >
      {/* Halo décoratif derrière les cartes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_200_61/0.35),transparent_65%)]"
      />
      <h2 id="raretes-titre" className="meme-caption relative text-4xl">
        {t("title")}
      </h2>
      <p className="relative mt-2 text-sm text-[#d9d3f5]">{t("lead")}</p>

      <ol className="relative -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 pt-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-5 lg:overflow-visible lg:px-0 lg:pb-9">
        {cards.map((card, i) => (
          <li key={card.id} className={`w-[8.25rem] shrink-0 snap-start lg:w-auto ${i % 2 === 1 ? "lg:translate-y-7" : ""}`}>
            <InteractiveCard card={card} size="compact" />
            <p className="mt-2 text-center text-sm font-extrabold">
              <span aria-hidden="true">{RARITY_GLYPH[card.rarity]} </span>
              {tr(card.rarity)}
            </p>
            <p className="text-center text-xs text-[#d9d3f5]">
              <RarityOdds rarity={card.rarity} />
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
