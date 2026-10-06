"use client";

import { useCallback, useState } from "react";
import type { Card } from "@/lib/validation/card";
import { CardDetailDialog } from "./CardDetailDialog";
import { MemeCard, type MemeCardSize } from "./MemeCard";

/** Carte cliquable : ouvre sa fiche détaillée sur fond flouté. */
export function InteractiveCard({
  card,
  size = "full",
  owned = true,
  className,
}: {
  card: Card;
  size?: MemeCardSize;
  owned?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <MemeCard card={card} size={size} owned={owned} onOpen={() => setOpen(true)} className={className} />
      {open ? <CardDetailDialog card={card} owned={owned} onClose={close} /> : null}
    </>
  );
}
