"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { Level } from "@/lib/economy/duplicates";
import type { Card } from "@/lib/validation/card";
import { CardDetailDialog } from "./CardDetailDialog";
import { MemeCard, type MemeCardSize } from "./MemeCard";

/** Carte cliquable : l'affiche en grand, seule, sur fond flouté. */
export function InteractiveCard({
  card,
  size = "full",
  owned = true,
  level = 0,
  quantity = 0,
  lead = false,
  actions,
  className,
}: {
  card: Card;
  size?: MemeCardSize;
  owned?: boolean;
  level?: Level;
  quantity?: number;
  /** Personnage choisi pour le Battle Royale : aura aux couleurs du thème autour de la carte. */
  lead?: boolean;
  /** Boutons affichés à côté de la carte agrandie (collection : faire évoluer, vendre). */
  actions?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <MemeCard card={card} size={size} owned={owned} level={level} quantity={quantity} lead={lead} onOpen={() => setOpen(true)} className={className} />
      {open ? <CardDetailDialog card={card} owned={owned} level={level} quantity={quantity} lead={lead} actions={actions} onClose={close} /> : null}
    </>
  );
}
