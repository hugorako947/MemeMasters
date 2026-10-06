"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NAV_STACK_KEY, updateStack } from "@/lib/navigation/back";

/**
 * Mémorise les pages visitées (pile) dans le stockage de session de l'onglet, pour
 * les liens « ← Retour à … ». Aucune donnée ne quitte le navigateur.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const stack = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) ?? "[]") as string[];
      sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(updateStack(Array.isArray(stack) ? stack : [], pathname)));
    } catch {
      // Stockage indisponible (navigation privée stricte) : le lien utilisera le parent logique.
    }
  }, [pathname]);
  return null;
}
