"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InteractiveCard } from "@/components/card/InteractiveCard";
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
 * 2. les cartes arrivent face cachée ; on les retourne une à une (de la plus
 *    courante à la plus rare) ou toutes d'un coup ;
 * 3. un récapitulatif compte les nouvelles cartes.
 */
export function BoosterOpening({ kind, onClose }: { kind: BoosterKind; onClose: (changed: boolean) => void }) {
  const t = useTranslations("opening");
  const te = useTranslations("errors");
  const ref = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<"pack" | "tearing" | "reveal">("pack");
  const [result, setResult] = useState<Opened | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
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
    setRevealed(res.data.cards.map(() => false));
    setPhase("reveal");
  }

  function reveal(i: number) {
    setRevealed((r) => r.map((v, j) => (j === i ? true : v)));
    const card = result?.cards[i];
    if (card && isAtLeast(card.rarity, "legendaire") && "vibrate" in navigator) navigator.vibrate?.(80);
  }

  const allRevealed = revealed.length > 0 && revealed.every(Boolean);
  const newCount = result?.newCardIds.length ?? 0;

  return createPortal(
    <dialog ref={ref} className="mm-detail" aria-label={t("title")}>
      <div className="relative grid max-h-[inherit] gap-5 overflow-y-auto rounded-[1.75rem] border-[3px] border-ink bg-paper p-4 shadow-[0_8px_0_0_var(--mm-shadow)] sm:p-6">
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-extrabold">{allRevealed ? t("summary", { count: newCount }) : t("tapToReveal")}</p>
              {!allRevealed ? (
                <button type="button" onClick={() => setRevealed((r) => r.map(() => true))} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
                  {t("revealAll")}
                </button>
              ) : null}
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {result!.cards.map((card, i) => (
                <li key={`${card.id}-${i}`} className="relative">
                  <div className={`mm-flip ${revealed[i] ? "is-revealed" : ""}`} data-rarity={card.rarity}>
                    <button
                      type="button"
                      className="mm-flip__back"
                      onClick={() => reveal(i)}
                      aria-label={t("revealOne", { index: i + 1 })}
                      tabIndex={revealed[i] ? -1 : 0}
                      aria-hidden={revealed[i]}
                    >
                      <span className="meme-caption text-[0.9rem] sm:text-base">{GAME_CONFIG.GAME_NAME}</span>
                    </button>
                    <div className="mm-flip__front" aria-hidden={!revealed[i]}>
                      {revealed[i] ? <InteractiveCard card={card} size="compact" /> : null}
                    </div>
                  </div>
                  {revealed[i] && result!.newCardIds.includes(card.id) ? (
                    <span className="pointer-events-none absolute -top-2 start-1/2 z-20 -translate-x-1/2 rounded-full border-2 border-ink bg-candy px-2 text-xs font-extrabold text-[var(--mm-accent-ink)] rtl:translate-x-1/2">
                      {t("newBadge")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {allRevealed ? (
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
