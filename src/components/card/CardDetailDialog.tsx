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
  actions,
  onClose,
}: {
  card: Card;
  owned?: boolean;
  level?: Level;
  quantity?: number;
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

  // Un clic en dehors de la carte ferme la vue ; un clic sur la carte (ou ses boutons Évoluer, Vendre) la garde ouverte.
  function onBackdrop(e: MouseEvent<HTMLDialogElement>) {
    if ((e.target as HTMLElement).closest(".mm-card")) return;
    ref.current?.close();
  }

  return createPortal(
    <dialog ref={ref} className="mm-detail mm-detail--card" onClick={onBackdrop} aria-label={card.name}>
      <div className="grid justify-items-center gap-3">
        {/* Fermeture : clic en dehors de la carte ou Échap. Bouton invisible, pour le clavier et les lecteurs d'écran. */}
        <button type="button" onClick={() => ref.current?.close()} className="sr-only">
          {t("close")}
        </button>
        <div className="w-full">
          <MemeCard card={card} owned={owned} level={level} quantity={quantity} actions={owned ? actions : undefined} />
        </div>
        {!owned ? <p className="rounded-full bg-surface px-4 py-2 text-center text-sm font-semibold">{t("notOwned")}</p> : null}
      </div>
    </dialog>,
    document.body,
  );
}
