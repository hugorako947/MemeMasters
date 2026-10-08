import { InteractiveCard } from "@/components/card/InteractiveCard";
import { RarityOdds } from "@/components/card/RarityOdds";
import { sampleOf } from "@/components/card/sample-cards";
import { RARITIES } from "@/config/rarities";

/** Les 7 raretés, avec la chance d'en obtenir une dans le booster le plus accessible. */
export function RaritiesGrid() {
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {RARITIES.map(sampleOf).map((card) => (
        <li key={card.id} className="mx-auto w-full max-w-[16rem]">
          <InteractiveCard card={card} />
          <p className="mt-3 text-center text-xs font-semibold text-ink-soft sm:text-sm">
            <RarityOdds rarity={card.rarity} />
          </p>
        </li>
      ))}
    </ol>
  );
}
