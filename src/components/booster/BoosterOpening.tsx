"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import type { BoosterKind } from "@/lib/economy/boosters";
import type { Card } from "@/lib/validation/card";

export interface OpenedBooster {
  kind: BoosterKind;
  cards: Card[];
  newCardIds: string[];
}

/**
 * Contenu d'un booster qui vient d'être ouvert : les 10 cartes d'un coup, de la
 * plus courante à la plus rare, qui arrivent l'une après l'autre. Le tirage est
 * déjà fait et enregistré par le serveur. Se ferme d'un clic en dehors de la
 * fenêtre, avec Échap ou avec « Continuer » ; toucher une carte l'affiche en grand.
 */
export function BoosterOpening({ opened, onClose }: { opened: OpenedBooster; onClose: () => void }) {
  const t = useTranslations("opening");
  const ref = useRef<HTMLDialogElement>(null);
  const newIds = new Set(opened.newCardIds);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.addEventListener("close", onClose);
    return () => dialog?.removeEventListener("close", onClose);
  }, [onClose]);

  // Clic sur le fond (en dehors de la fenêtre) : fermeture. Les clics venant de la
  // carte agrandie (autre fenêtre) ou des cartes elles-mêmes ne ferment rien.
  function onBackdrop(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) ref.current?.close();
  }

  return createPortal(
    <dialog ref={ref} className="mm-detail" aria-label={t("title")} onClick={onBackdrop}>
      <div className="grid max-h-[inherit] gap-5 overflow-y-auto rounded-[1.75rem] border-2 border-ink bg-paper p-4 shadow-[0_5px_0_0_var(--mm-shadow)] sm:p-6">
        <p className="text-center font-display text-3xl leading-none">{t("summary", { count: newIds.size })}</p>
        <ul className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-5">
          {opened.cards.map((card, i) => (
            <li key={`${card.id}-${i}`} className="mm-reveal-card relative" style={{ ["--i" as string]: i }}>
              <InteractiveCard card={card} size="compact" />
              {newIds.has(card.id) ? (
                <span className="pointer-events-none absolute -top-2 start-1/2 z-20 -translate-x-1/2 rounded-full border-2 border-ink bg-candy px-2 text-xs font-extrabold text-[var(--mm-accent-ink)] rtl:translate-x-1/2">
                  {t("newBadge")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => ref.current?.close()} className="mm-btn mm-btn--primary justify-self-center px-8">
          {t("done")}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
