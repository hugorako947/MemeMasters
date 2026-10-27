"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Level } from "@/lib/economy/duplicates";
import type { Card } from "@/lib/validation/card";
import { MemeCard } from "./MemeCard";

/**
 * Carte affichée en grand, seule, sur fond flouté : le joueur se concentre
 * sur la carte elle-même. Se ferme d'un clic en dehors de la carte, ou avec Échap.
 */
export function CardDetailDialog({
  card,
  owned = true,
  level = 0,
  quantity = 0,
  lead = false,
  actions,
  onClose,
}: {
  card: Card;
  owned?: boolean;
  level?: Level;
  quantity?: number;
  /** Personnage choisi pour le Battle Royale : libellé « Personnage » en dégradé au-dessus de la carte. */
  lead?: boolean;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations("detail");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const onCloseEvent = () => onClose();
    dialog?.addEventListener("close", onCloseEvent);
    return () => dialog?.removeEventListener("close", onCloseEvent);
  }, [onClose]);

  // Les boutons Évoluer/Vendre sont à côté de la carte (plus dessus) : un clic sur la carte, son libellé ou ses boutons
  // garde la vue ouverte ; un clic en dehors de cet ensemble (ou Échap) ferme.
  function onBackdrop(e: MouseEvent<HTMLDialogElement>) {
    if ((e.target as HTMLElement).closest(".mm-detail__stack")) return;
    ref.current?.close();
  }

  return createPortal(
    <dialog ref={ref} className="mm-detail mm-detail--card" onClick={onBackdrop} aria-label={card.name}>
      <div className="mm-detail__stack grid w-full max-w-[22rem] justify-items-center gap-3">
        {/* Fermeture : clic en dehors de l'ensemble ou Échap. Bouton invisible, pour le clavier et les lecteurs d'écran. */}
        <button type="button" onClick={() => ref.current?.close()} className="sr-only">
          {t("close")}
        </button>
        {lead ? <p className="mm-detail__lead">{t("lead")}</p> : null}
        <div className="w-full">
          <MemeCard card={card} owned={owned} level={level} quantity={quantity} />
        </div>
        {!owned ? <p className="rounded-full bg-surface px-4 py-2 text-center text-sm font-semibold">{t("notOwned")}</p> : null}
        {owned && actions ? <div className="w-full max-w-[20rem]">{actions}</div> : null}
      </div>
    </dialog>,
    document.body,
  );
}
