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
  actions,
  className,
}: {
  card: Card;
  size?: MemeCardSize;
  owned?: boolean;
  level?: Level;
  quantity?: number;
  /** Boutons affichés sur la carte agrandie (collection : faire évoluer, vendre). */
  actions?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <MemeCard card={card} size={size} owned={owned} level={level} quantity={quantity} onOpen={() => setOpen(true)} className={className} />
      {open ? <CardDetailDialog card={card} owned={owned} level={level} quantity={quantity} actions={actions} onClose={close} /> : null}
    </>
  );
}
