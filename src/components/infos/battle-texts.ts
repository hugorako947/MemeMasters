import { getFormatter, getTranslations } from "next-intl/server";
import type { BattleCharacter } from "@/lib/br/character";

/**
 * Phrases qui décrivent la capacité active et le passif d'un personnage du Battle Royale,
 * avec ses vrais chiffres (pages d'Infos, et plus tard la fiche personnage de la Collection).
 */
export async function battleTexts(c: BattleCharacter, regenDelayMs: number, regenCapPercent: number): Promise<{ ability: string; passive: string }> {
  const t = await getTranslations("battleRoyale");
  const ts = await getTranslations("statLower");
  const format = await getFormatter();
  const percent = (permille: number) => format.number(permille / 10, { maximumFractionDigits: 1 });
  const seconds = (ms: number) => format.number(ms / 1000, { maximumFractionDigits: 1 });
  const a = c.ability;
  const stat = a.stat ? ts(a.stat) : "";
  const ability = {
    sprint: () => t("ability.sprint", { percent: percent(a.permille), seconds: seconds(a.durationMs) }),
    stun: () => t("ability.stun", { window: seconds(a.durationMs), seconds: seconds(a.effectMs) }),
    drain: () => t("ability.drain", { percent: percent(a.permille), seconds: seconds(a.durationMs) }),
    multi: () => t("ability.multi", { hits: a.hits, percent: percent(a.permille) }),
    burn: () => t("ability.burn", { percent: percent(a.permille), seconds: seconds(a.effectMs) }),
    pierce: () => t("ability.pierce", { percent: percent(a.permille), seconds: seconds(a.durationMs) }),
    buff: () => t("ability.buff", { percent: percent(a.permille), stat, seconds: seconds(a.durationMs) }),
    debuff: () => t("ability.debuff", { window: seconds(a.durationMs), percent: percent(a.permille), stat, seconds: seconds(a.effectMs) }),
  }[a.kind]();
  const p = c.passive;
  const passive = {
    regen: () => t("passive.regen", { delay: seconds(regenDelayMs), percent: percent(p.permille), cap: regenCapPercent }),
    dodge: () => t("passive.dodge", { percent: percent(p.permille) }),
    reflect: () => t("passive.reflect", { percent: percent(p.permille) }),
    cleanse: () => t("passive.cleanse", { percent: percent(p.permille) }),
    recharge: () => t("passive.recharge", { percent: percent(p.permille) }),
  }[p.kind]();
  return { ability, passive };
}
