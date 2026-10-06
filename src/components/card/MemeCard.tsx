"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, type PointerEvent } from "react";
import { RARITY_GLYPH, rarityTier } from "@/config/rarities";
import { VIBE_EMOJI } from "@/config/vibes";
import { cardArtDataUri } from "@/lib/art/generate";
import type { Card } from "@/lib/validation/card";

export type MemeCardSize = "full" | "compact";

export interface MemeCardProps {
  card: Card;
  size?: MemeCardSize;
  /** Désactive l'inclinaison et les reflets au pointeur (listes longues, impression). */
  static?: boolean;
  className?: string;
}

/** Inclinaison maximale (degrés) selon la rareté : les cartes rares bougent plus. */
function maxTilt(tier: number): number {
  return tier >= 4 ? 14 : tier >= 1 ? 8 : 5;
}

/**
 * Carte meme. Les 8 raretés partagent la même structure ; leur identité
 * visuelle vient de globals.css (attribut data-rarity). Le pointeur pilote
 * des variables CSS directement sur l'élément : aucun re-rendu React.
 */
export function MemeCard({ card, size = "full", static: isStatic = false, className }: MemeCardProps) {
  const t = useTranslations();
  const ref = useRef<HTMLElement>(null);
  const tier = rarityTier(card.rarity);
  const art = useMemo(
    () => card.imageUrl ?? cardArtDataUri({ seed: card.artSeed, vibe: card.vibe, rarity: card.rarity }),
    [card.imageUrl, card.artSeed, card.vibe, card.rarity],
  );

  const onMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const el = ref.current;
      if (!el || isStatic) return;
      const rect = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      const tilt = maxTilt(tier);
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
      el.style.setProperty("--rx", `${((0.5 - py) * tilt).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((px - 0.5) * tilt).toFixed(2)}deg`);
      el.dataset.active = "true";
    },
    [isStatic, tier],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0.5");
    el.style.setProperty("--py", "0.5");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.dataset.active = "false";
  }, []);

  const rarityLabel = t(`rarity.${card.rarity}`);
  const vibeLabel = t(`vibe.${card.vibe}`);
  const { specialAttack: special } = card;

  return (
    <article
      ref={ref}
      className={`mm-card ${className ?? ""}`}
      data-rarity={card.rarity}
      data-size={size}
      data-active="false"
      aria-label={t("card.ariaLabel", { name: card.name, rarity: rarityLabel, vibe: vibeLabel, hp: card.hp })}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
    >
      <div className="mm-card__tilt">
        <div className="mm-card__frame">
          <div className="mm-card__inner">
            <header className="mm-card__head">
              <span className="mm-card__hp">
                {card.hp}
                <abbr title={t("card.hp")}>{t("card.hp")}</abbr>
              </span>
              <span className="mm-card__vibe">
                <span aria-hidden="true">{VIBE_EMOJI[card.vibe]}</span>
                {vibeLabel}
              </span>
            </header>

            <div className="mm-card__art">
              {/* Illustration générée (data:) ou image Storage : pas d'optimisation next/image nécessaire. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art} alt="" draggable={false} decoding="async" />
              <div className="mm-card__fx" aria-hidden="true" />
              <p className="mm-card__caption meme-caption" aria-hidden="true">
                {card.name}
              </p>
            </div>

            <div className="mm-card__body">
              <dl className="mm-card__stats">
                <div className="mm-card__stat">
                  <dt>{t("card.atk")}</dt>
                  <dd>{card.atk}</dd>
                </div>
                <div className="mm-card__stat">
                  <dt>{t("card.def")}</dt>
                  <dd>{card.def}</dd>
                </div>
                <div className="mm-card__stat">
                  <dt>{t("card.spd")}</dt>
                  <dd>{card.spd}</dd>
                </div>
              </dl>
              <ul className="mm-card__moves">
                <li className="mm-card__move">
                  <span className="mm-card__move-name">
                    <span className="mm-card__move-kind">{t("card.attack")}</span>
                    {card.normalAttack.name}
                  </span>
                  <span className="mm-card__move-power">{card.normalAttack.power}</span>
                </li>
                <li className="mm-card__move">
                  <span className="mm-card__move-name">
                    <span className="mm-card__move-kind">
                      <span className="mm-card__pips" aria-label={t("card.energyCost", { count: special.energyCost })}>
                        {Array.from({ length: special.energyCost }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      {t("card.special")}
                    </span>
                    {special.name}
                  </span>
                  <span className="mm-card__move-power">{special.power}</span>
                </li>
                <li className="mm-card__move">
                  <span className="mm-card__move-name">
                    <span className="mm-card__move-kind">{t("card.defense")}</span>
                    {card.defenseAbility.name}
                  </span>
                </li>
              </ul>
            </div>

            <footer className="mm-card__strip">
              <span aria-hidden="true">{RARITY_GLYPH[card.rarity]}</span>
              {rarityLabel}
            </footer>
          </div>
          <div className="mm-card__glare" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
