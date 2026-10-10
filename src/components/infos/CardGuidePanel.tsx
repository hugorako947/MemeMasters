import { getTranslations } from "next-intl/server";
import { MemeCard } from "@/components/card/MemeCard";
import { sampleOf } from "@/components/card/sample-cards";
import { InfoSection } from "./InfoBlocks";

/**
 * Page « Carte » d'Infos : chaque élément d'une carte expliqué, sur une
 * vraie carte du jeu (les chiffres de l'exemple sont lus sur la carte).
 */
export async function CardGuidePanel() {
  const t = await getTranslations("infos.card");
  const card = sampleOf("rare");
  const enemyDef = 35;
  const damage = Math.round((card.normalAttack.power * card.atk) / enemyDef);
  const special = card.specialAttack;

  const items: Array<{ title: string; text: string }> = [
    { title: t("nameTitle"), text: t("name") },
    { title: t("hpTitle", { hp: card.hp }), text: t("hp") },
    { title: t("atkTitle", { atk: card.atk }), text: t("atk") },
    { title: t("defTitle", { def: card.def }), text: t("def") },
    { title: t("spdTitle", { spd: card.spd }), text: t("spd") },
    { title: t("attackTitle", { name: card.normalAttack.name, power: card.normalAttack.power }), text: t("attack") },
    {
      title: t("whyTitle", { atk: card.atk, power: card.normalAttack.power }),
      text: t("why", { atk: card.atk, power: card.normalAttack.power, def: enemyDef, damage }),
    },
    { title: t("specialTitle", { name: special.name, power: special.power }), text: t("special") },
    { title: t("energyTitle", { count: special.energyCost }), text: t("energy", { count: special.energyCost }) },
    { title: t("defenseTitle", { name: card.defenseAbility.name }), text: t("defense") },
    { title: t("extrasTitle"), text: t("extras") },
  ];

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="mx-auto w-full max-w-[20rem] md:sticky md:top-6">
        <MemeCard card={card} quantity={3} />
      </div>
      <InfoSection title={t("title")}>
        <p className="text-ink-soft">{t("lead")}</p>
        <ol className="grid gap-3">
          {items.map((item, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl bg-paper p-3">
              <span className="grid size-7 place-items-center rounded-full bg-candy font-display text-sm text-[var(--mm-accent-ink)]">{i + 1}</span>
              <div>
                <p className="font-extrabold">{item.title}</p>
                <p className="text-sm text-ink-soft">{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-soft">{t("soon")}</p>
      </InfoSection>
    </div>
  );
}
