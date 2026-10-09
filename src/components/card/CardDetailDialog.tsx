"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RARITY_GLYPH } from "@/config/rarities";
import { VIBE_EMOJI, beatenBy, beats } from "@/config/vibes";
import type { Card, DefenseEffect, SpecialEffect } from "@/lib/validation/card";
import { GAME_CONFIG } from "@/config/game.config";
import { boostedStats, type Level } from "@/lib/economy/duplicates";
import { MemeCard } from "./MemeCard";
import { RarityOdds } from "./RarityOdds";

const STAT_MAX = { hp: 140, atk: 65, def: 65, spd: 100 } as const;
const STAT_COLOR = { hp: "#127a4b", atk: "#ff3d7f", def: "#2d5bff", spd: "#f5a400" } as const;

/**
 * Fiche détaillée d'une carte, dans une fenêtre modale native (<dialog>) :
 * piège du focus, touche Échap et retour du focus gérés par le navigateur.
 * L'arrière-plan est flouté (::backdrop, voir globals.css).
 */
export function CardDetailDialog({
  card,
  owned = true,
  level = 0,
  detail,
  onClose,
}: {
  card: Card;
  owned?: boolean;
  level?: Level;
  detail?: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations();
  const stats = boostedStats(card, level);
  const bonus = GAME_CONFIG.DUPLICATES.STAT_BONUS_PERCENT[level];
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Un clic sur le fond flouté (hors du contenu) ferme la fenêtre.
  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) ref.current?.close();
  }

  const statLabel = (s: "atk" | "def" | "spd") => t(`statLower.${s}`);

  const describeSpecial = (e: SpecialEffect) => {
    switch (e.kind) {
      case "none":
        return t("effect.none");
      case "dot":
        return t("effect.dot", { percent: e.percent, turns: e.turns });
      case "stun":
        return t("effect.stun", { chance: e.chance });
      case "debuff":
        return t("effect.debuff", { stat: statLabel(e.stat) });
      case "buff":
        return t("effect.buff", { stat: statLabel(e.stat) });
      case "pierce":
        return t("effect.pierce", { percent: e.percent });
      case "drain":
        return t("effect.drain", { percent: e.percent });
      case "multi":
        return t("effect.multi", { hits: e.hits, percent: e.percent });
    }
  };
  const describeDefense = (e: DefenseEffect) => {
    switch (e.kind) {
      case "reflect":
        return t("effect.reflect", { percent: e.percent });
      case "dodge":
        return t("effect.dodge", { chance: e.chance });
      case "heal":
        return t("effect.heal", { percent: e.percent });
      case "recharge":
        return t("effect.recharge");
      case "cleanse":
        return t("effect.cleanse");
    }
  };

  const titleId = `detail-${card.id}`;

  // Rendue directement dans <body> : le reste de la page (#mm-app) peut alors
  // être flouté sans flouter la fenêtre elle-même (voir globals.css).
  return createPortal(
    <dialog ref={ref} className="mm-detail" aria-labelledby={titleId} onClick={onBackdropClick}>
      <div className="relative max-h-[inherit] overflow-y-auto rounded-[1.75rem] border-2 border-ink bg-paper p-4 shadow-[0_5px_0_0_var(--mm-shadow)] sm:p-6">
        <div className="sticky top-0 z-20 mb-3 flex justify-end md:-mb-12">
          <button type="button" onClick={() => ref.current?.close()} className="mm-btn mm-btn--secondary min-h-11 px-3 text-sm">
            <span aria-hidden="true">✕</span> {t("detail.close")}
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,19rem)_1fr] md:items-start">
          <div className="mx-auto w-full max-w-[17rem] md:sticky md:top-0 md:max-w-none">
            <MemeCard card={card} owned={owned} level={level} />
          </div>

          <div className="grid gap-5">
            <header className="md:pe-32">
              <h2 id={titleId} className="font-display text-4xl leading-none sm:text-5xl">
                {card.name}
              </h2>
              <p className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full border-2 border-ink bg-surface px-3 py-1">
                  <span aria-hidden="true">{RARITY_GLYPH[card.rarity]} </span>
                  {t(`rarity.${card.rarity}`)}
                </span>
                <span className="rounded-full border-2 border-ink bg-surface px-3 py-1">
                  <span aria-hidden="true">{VIBE_EMOJI[card.vibe]} </span>
                  {t(`vibe.${card.vibe}`)}
                </span>
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                <RarityOdds rarity={card.rarity} />
              </p>
            </header>

            {detail}

            {!owned ? (
              <p className="rounded-xl border-2 border-dashed border-ink-soft bg-surface p-4 font-semibold">{t("detail.notOwned")}</p>
            ) : (
              <>
                {card.description ? (
                  <blockquote className="rounded-xl border-l-4 border-candy bg-surface px-4 py-3 text-lg italic">
                    {card.description}
                  </blockquote>
                ) : null}

                <section className="grid gap-3">
                  <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                    {t("detail.stats")}
                    {bonus > 0 ? (
                      <span className="rounded-full bg-sticker px-2.5 py-0.5 text-xs font-extrabold text-[#1a1238]">{t("detail.statBonus", { percent: bonus })}</span>
                    ) : null}
                  </h3>
                  {(["hp", "atk", "def", "spd"] as const).map((key) => (
                    <div key={key} className="grid grid-cols-[6.5rem_2.5rem_1fr] items-center gap-3 text-sm">
                      <span className="font-semibold">{t(`statName.${key}`)}</span>
                      <span className="text-end font-display text-xl">{stats[key]}</span>
                      <span className="mm-stat-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.min(100, Math.round((stats[key] / STAT_MAX[key]) * 100))}%`,
                            ["--bar" as string]: STAT_COLOR[key],
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </section>

                <section className="grid gap-3">
                  <h3 className="text-lg font-extrabold">{t("detail.moves")}</h3>
                  <dl className="grid gap-3">
                    <Move
                      kind={t("detail.attack")}
                      name={card.normalAttack.name}
                      power={t("detail.power", { power: card.normalAttack.power })}
                    />
                    <Move
                      kind={t("detail.special")}
                      name={card.specialAttack.name}
                      power={`${t("detail.power", { power: card.specialAttack.power })} · ${t("card.energyCost", { count: card.specialAttack.energyCost })}`}
                      effect={describeSpecial(card.specialAttack.effect)}
                    />
                    <Move kind={t("detail.defense")} name={card.defenseAbility.name} effect={describeDefense(card.defenseAbility.effect)} />
                  </dl>
                </section>

                <section className="grid gap-2">
                  <h3 className="text-lg font-extrabold">{t("detail.vibeTitle")}</h3>
                  <p className="flex flex-wrap gap-2 text-sm font-semibold">
                    <span className="rounded-full bg-[#d8f5e5] px-3 py-1 text-success">
                      {t("detail.strongAgainst", { vibe: t(`vibe.${beats(card.vibe)}`) })}
                    </span>
                    <span className="rounded-full bg-[#ffe0e6] px-3 py-1 text-danger">
                      {t("detail.weakAgainst", { vibe: t(`vibe.${beatenBy(card.vibe)}`) })}
                    </span>
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function Move({ kind, name, power, effect }: { kind: string; name: string; power?: string; effect?: string }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-surface px-4 py-3">
      <dt className="text-xs font-bold text-ink-soft">{kind}</dt>
      <dd>
        <p className="font-extrabold">{name}</p>
        {power ? <p className="text-sm">{power}</p> : null}
        {effect ? <p className="text-sm text-ink-soft">{effect}</p> : null}
      </dd>
    </div>
  );
}
