"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { Card } from "@/lib/validation/card";
import { CardDetailDialog } from "./CardDetailDialog";
import type { Level } from "@/lib/economy/duplicates";
import { MemeCard, type MemeCardSize } from "./MemeCard";

/** Carte cliquable : ouvre sa fiche détaillée sur fond flouté. */
export function InteractiveCard({
  card,
  size = "full",
  owned = true,
  level = 0,
  detail,
  className,
}: {
  card: Card;
  size?: MemeCardSize;
  owned?: boolean;
  level?: Level;
  /** Contenu ajouté à la fiche (ex. : actions sur les doublons dans la collection). */
  detail?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <MemeCard card={card} size={size} owned={owned} level={level} onOpen={() => setOpen(true)} className={className} />
      {open ? <CardDetailDialog card={card} owned={owned} level={level} detail={detail} onClose={close} /> : null}
    </>
  );
}
