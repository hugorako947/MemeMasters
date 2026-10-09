"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { MemeCard } from "@/components/card/MemeCard";
import { FormMessage } from "@/components/ui/Field";
import { GAME_CONFIG } from "@/config/game.config";
import { isAtLeast } from "@/config/rarities";
import { postJson } from "@/lib/client/api";
import type { BoosterKind } from "@/lib/economy/boosters";
import type { Card } from "@/lib/validation/card";

interface Opened {
  cards: Card[];
  newCardIds: string[];
}

const PACK_CLASS: Record<BoosterKind, string> = { daily: "", special: "mm-pack--special", very_special: "mm-pack--ultra" };

/**
 * Ouverture d'un booster, sur fond flouté :
 * 1. on touche le sachet, qui se déchire (le serveur tire et enregistre les cartes) ;
 * 2. les cartes arrivent UNE PAR UNE, face cachée, de la plus courante à la
 *    plus rare : on ne peut pas sauter à la dernière ; « Révéler la suite »
 *    enchaîne automatiquement, toujours dans l'ordre ;
 * 3. un récapitulatif compte les nouvelles cartes.
 */
export function BoosterOpening({ kind, onClose }: { kind: BoosterKind; onClose: (changed: boolean) => void }) {
  const t = useTranslations("opening");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<"pack" | "tearing" | "reveal">("pack");
  const [result, setResult] = useState<Opened | null>(null);
  // Révélation à la file : une seule carte à la fois, de la plus courante à la plus rare.
  const [current, setCurrent] = useState(0);
  const [faceUp, setFaceUp] = useState(false);
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = result !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  const close = useCallback(() => onClose(changed), [onClose, changed]);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.addEventListener("close", close);
    return () => dialog?.removeEventListener("close", close);
  }, [close]);

  async function tear() {
    if (phase !== "pack") return;
    setPhase("tearing");
    setError(null);
    const [res] = await Promise.all([
      postJson<Opened>("/api/boosters/open", { kind }),
      new Promise((r) => setTimeout(r, 650)), // laisse le temps de voir le sachet se déchirer
    ]);
    if (!res.ok) {
      setPhase("pack");
      setError(te(res.code as "server_error"));
      return;
    }
    setResult(res.data);
    setCurrent(0);
    setFaceUp(false);
    setPhase("reveal");
  }

  const cards = result?.cards ?? [];
  const finished = phase === "reveal" && current >= cards.length;
  const newCount = result?.newCardIds.length ?? 0;

  // Retourne la carte en cours, ou passe à la suivante si elle est déjà retournée.
  const step = useCallback(() => {
    if (!result || current >= result.cards.length) return;
    if (!faceUp) {
      setFaceUp(true);
      const card = result.cards[current];
      if (isAtLeast(card.rarity, "legendaire") && "vibrate" in navigator) navigator.vibrate?.(80);
    } else {
      setFaceUp(false);
      setCurrent((c) => c + 1);
    }
  }, [result, current, faceUp]);

  // « Révéler la suite » : enchaîne automatiquement, toujours dans l'ordre.
  useEffect(() => {
    if (!auto || finished) return;
    const timer = setTimeout(step, faceUp ? 650 : 250);
    return () => clearTimeout(timer);
  }, [auto, finished, faceUp, step]);

  return createPortal(
    <dialog ref={ref} className="mm-detail" aria-label={t("title")}>
      <div className="relative grid max-h-[inherit] gap-5 overflow-y-auto rounded-[1.75rem] border-2 border-ink bg-paper p-4 shadow-[0_5px_0_0_var(--mm-shadow)] sm:p-6">
        {phase !== "reveal" ? (
          <div className="grid justify-items-center gap-5 py-6">
            <button
              type="button"
              onClick={tear}
              disabled={phase === "tearing"}
              aria-label={t("tapToOpen")}
              className={`mm-pack-stage w-44 sm:w-52 ${phase === "tearing" ? "mm-tearing" : "mm-pack-tease"}`}
            >
              <div className={`mm-pack mm-pack--hero ${PACK_CLASS[kind]}`}>
                <span className="mm-pack__tear" aria-hidden="true" />
                <span className="mm-pack__label meme-caption">{GAME_CONFIG.GAME_NAME}</span>
                <span className="mm-pack__count">{t("cards", { count: GAME_CONFIG.BOOSTER_SIZE })}</span>
              </div>
            </button>
            <p className="font-extrabold">{phase === "tearing" ? t("opening") : t("tapToOpen")}</p>
            {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          </div>
        ) : (
          <>
            {!finished ? (
              <div className="grid justify-items-center gap-4">
                <p className="text-sm font-extrabold text-ink-soft">{t("counter", { index: current + 1, total: cards.length })}</p>
                {/* La carte en cours, seule : impossible de sauter à la dernière. */}
                {/* div rôle bouton : une carte (article) ne peut pas être placée dans un <button>. */}
                <div
                  key={current}
                  role="button"
                  tabIndex={0}
                  onClick={step}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      step();
                    }
                  }}
                  aria-label={faceUp ? t("next") : t("revealOne", { index: current + 1 })}
                  className="mm-flip mm-flip--solo w-44 cursor-pointer sm:w-52"
                  data-rarity={cards[current].rarity}
                >
                  <span className={`mm-flip__inner ${faceUp ? "is-revealed" : ""}`}>
                    <span className="mm-flip__back" aria-hidden="true">
                      <span className="meme-caption text-xl">{GAME_CONFIG.GAME_NAME}</span>
                    </span>
                    <span className="mm-flip__front" aria-hidden={!faceUp}>
                      {faceUp ? <MemeCard card={cards[current]} size="compact" /> : null}
                    </span>
                  </span>
                  {faceUp && result!.newCardIds.includes(cards[current].id) ? (
                    <span className="absolute -top-3 start-1/2 z-20 -translate-x-1/2 rounded-full border-2 border-ink bg-candy px-3 py-0.5 text-sm font-extrabold text-[var(--mm-accent-ink)] rtl:translate-x-1/2">
                      {t("newBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="font-extrabold">{faceUp ? t("tapForNext") : t("tapToReveal")}</p>
                {!auto ? (
                  <button type="button" onClick={() => setAuto(true)} className="mm-btn mm-btn--ghost min-h-10 text-sm">
                    {t("revealRest")}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-center font-display text-3xl">{t("summary", { count: newCount })}</p>
            )}

            {/* Les cartes déjà vues s'alignent en dessous, dans l'ordre. */}
            {current > 0 ? (
              <ul className={`grid gap-2 ${finished ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-5 sm:grid-cols-10"}`}>
                {cards.slice(0, current).map((card, i) => (
                  <li key={`${card.id}-${i}`} className="relative">
                    {finished ? <InteractiveCard card={card} size="compact" /> : <MemeCard card={card} size="compact" static />}
                    {finished && result!.newCardIds.includes(card.id) ? (
                      <span className="pointer-events-none absolute -top-2 start-1/2 z-20 -translate-x-1/2 rounded-full border-2 border-ink bg-candy px-2 text-xs font-extrabold text-[var(--mm-accent-ink)] rtl:translate-x-1/2">
                        {t("newBadge")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {finished ? (
              <button type="button" onClick={() => ref.current?.close()} className="mm-btn mm-btn--primary justify-self-center px-8">
                {t("done")}
              </button>
            ) : null}
          </>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
