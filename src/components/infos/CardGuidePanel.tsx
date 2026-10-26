import { getFormatter, getTranslations } from "next-intl/server";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { sampleOf } from "@/components/card/sample-cards";
import { BR_WEAPONS, GAME_CONFIG } from "@/config/game.config";
import { battleCharacter, bulletDamage, damageTakenPermille } from "@/lib/br/character";
import { battleTexts } from "./battle-texts";
import { InfoSection } from "./InfoBlocks";

/**
 * Page « Carte » d'Infos : chaque élément d'une carte expliqué, sur une vraie carte du jeu,
 * avec ce qu'il devient dans le Battle Royale (la carte est un personnage jouable). Tous les
 * chiffres sont calculés par les formules du moteur à partir de la configuration.
 */
export async function CardGuidePanel() {
  const t = await getTranslations("infos.card");
  const tw = await getTranslations("battleRoyale.weapons");
  const format = await getFormatter();
  const { BATTLE_ROYALE: BR, DUPLICATES } = GAME_CONFIG;
  const card = sampleOf("rare");
  const special = card.specialAttack;
  const c = battleCharacter(card, 0, BR, DUPLICATES.STAT_BONUS_PERCENT);
  const { ability, passive } = await battleTexts(c, BR.PASSIVE.REGEN_DELAY_MS, BR.PASSIVE.REGEN_CAP_PERCENT);
  // Exemple chiffré : une balle de mitraillette contre un personnage moyen (la commune de référence).
  const example = BR.WEAPONS.rafaleuse;
  const averageDef = BR.CHARACTER.REFERENCE.def;
  const { shot, hit } = bulletDamage(example.damage, c.weaponPercent, averageDef);
  const averageReduction = 100 - Math.floor(damageTakenPermille(averageDef) / 10);
  const seconds = (ms: number) => format.number(ms / 1000, { maximumFractionDigits: 1 });

  const items: Array<{ title: string; text: string }> = [
    { title: t("nameTitle"), text: t("name") },
    { title: t("hpTitle", { hp: card.hp }), text: t("hp", { maxHp: c.maxHp, radius: c.hitRadius }) },
    { title: t("atkTitle", { atk: card.atk }), text: t("atk", { percent: c.weaponPercent }) },
    { title: t("defTitle", { def: card.def }), text: t("def", { percent: 100 - c.damageTakenPercent }) },
    { title: t("spdTitle", { spd: card.spd }), text: t("spd", { speed: c.speed }) },
    {
      title: t("attackTitle", { name: card.normalAttack.name, power: card.normalAttack.power }),
      text: t("attack", { weapons: format.list(BR_WEAPONS.filter((w) => w !== BR.STARTING_WEAPON).map((w) => tw(w)), { type: "conjunction" }) }),
    },
    {
      title: t("exampleTitle"),
      text: t("example", { weapon: tw("rafaleuse"), damage: example.damage, shot, reduction: averageReduction, hit }),
    },
    { title: t("specialTitle", { name: special.name, power: special.power }), text: t("special", { ability }) },
    {
      title: t("energyTitle", { count: special.energyCost }),
      text: t("energy", { seconds: seconds(c.ability.cooldownMs), base: seconds(BR.ABILITY.COOLDOWN_BASE_MS), per: seconds(BR.ABILITY.COOLDOWN_PER_ENERGY_MS) }),
    },
    { title: t("defenseTitle", { name: card.defenseAbility.name }), text: t("defense", { passive }) },
    { title: t("extrasTitle"), text: t("extras", { factor: BR.CHARACTER.EVOLUTION_FACTOR_PERCENT }) },
  ];

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="mx-auto w-full max-w-[20rem] md:sticky md:top-6">
        <InteractiveCard card={card} quantity={3} />
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
