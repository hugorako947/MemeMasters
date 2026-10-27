"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { InteractiveCard } from "@/components/card/InteractiveCard";
import { MemeCard } from "@/components/card/MemeCard";
import type { BoosterKind } from "@/lib/economy/boosters";
import type { Card } from "@/lib/validation/card";

export interface OpenedBooster {
  kind: BoosterKind;
  cards: Card[];
  newCardIds: string[];
}

/**
 * Contenu d'un booster qui vient d'être ouvert. Pour garder le suspense, les cartes se révèlent
 * **une par une** : un clic (sur la carte ou « Suivante ») passe à la suivante, de la plus courante
 * à la plus rare. La dernière révélée, un récapitulatif montre les 10 cartes. Le tirage est déjà fait
 * et enregistré par le serveur. Se ferme d'un clic en dehors de la fenêtre, avec Échap ou « Continuer ».
 */
export function BoosterOpening({ opened, onClose }: { opened: OpenedBooster; onClose: () => void }) {
  const t = useTranslations("opening");
  const ref = useRef<HTMLDialogElement>(null);
  const newIds = new Set(opened.newCardIds);
  const total = opened.cards.length;
  // Carte en cours de révélation (0 à total-1), puis le récapitulatif.
  const [index, setIndex] = useState(0);
  const [recap, setRecap] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.addEventListener("close", onClose);
    return () => dialog?.removeEventListener("close", onClose);
  }, [onClose]);

  function advance() {
    if (index < total - 1) setIndex((i) => i + 1);
    else setRecap(true);
  }

  // Clic sur le fond (en dehors de la fenêtre) : fermeture. Les clics venant de la
  // carte agrandie (autre fenêtre) ou du contenu ne ferment rien.
  function onBackdrop(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) ref.current?.close();
  }

  const current = opened.cards[index];
  const isNew = newIds.has(current.id);

  return createPortal(
    <dialog ref={ref} className="mm-detail" aria-label={t("title")} onClick={onBackdrop}>
      {recap ? (
        <div className="mm-detail__stack grid max-h-[inherit] w-full justify-items-center gap-5 overflow-y-auto rounded-[1.75rem] border-2 border-ink bg-paper p-4 shadow-[0_5px_0_0_var(--mm-shadow)] sm:p-6">
          <p className="text-center font-display text-3xl leading-none">{t("summary", { count: newIds.size })}</p>
          <ul className="grid w-full grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-5">
            {opened.cards.map((card, i) => (
              <li key={`${card.id}-${i}`} className="relative">
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
      ) : (
        <div className="mm-detail__stack grid w-full justify-items-center gap-4">
          <p className="rounded-full border-2 border-ink bg-paper px-4 py-1 font-display text-xl leading-none text-ink">
            {t("progress", { index: index + 1, total })}
          </p>
          {/* Un clic sur la carte révèle la suivante : c'est là tout le suspense de l'ouverture. */}
          <button type="button" onClick={advance} aria-label={t("next")} className="mm-reveal-card relative w-[min(72vw,20rem)] cursor-pointer" style={{ ["--i" as string]: 0 }} key={index}>
            <MemeCard card={current} />
            {isNew ? (
              <span className="pointer-events-none absolute -top-2 start-1/2 z-20 -translate-x-1/2 rounded-full border-2 border-ink bg-candy px-2.5 py-0.5 text-sm font-extrabold text-[var(--mm-accent-ink)] rtl:translate-x-1/2">
                {t("newBadge")}
              </span>
            ) : null}
          </button>
          <button type="button" onClick={advance} className="mm-btn mm-btn--primary justify-self-center px-8">
            {index < total - 1 ? t("next") : t("reveal")}
          </button>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
