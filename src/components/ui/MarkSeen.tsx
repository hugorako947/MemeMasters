"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { postJson } from "@/lib/client/api";

/** Marque une notification comme vue dès l'affichage de la page, puis met à jour la navigation. */
export function MarkSeen({ seenKey }: { seenKey: "news" | "boosters" | "shop" }) {
  const router = useRouter();
  useEffect(() => {
    postJson("/api/seen", { key: seenKey }).then((r) => {
      if (r.ok) router.refresh();
    });
  }, [seenKey, router]);
  return null;
}
