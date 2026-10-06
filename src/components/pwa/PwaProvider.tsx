"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

/**
 * Enregistre le service worker (servi par src/app/serwist/[path]/route.ts).
 * Désactivé en développement pour éviter les caches fantômes, sauf si
 * NEXT_PUBLIC_ENABLE_SW_DEV=1. L'invite de mise à jour arrive en phase 6.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const disabled = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_SW_DEV !== "1";
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={disabled} reloadOnOnline={false}>
      {children}
    </SerwistProvider>
  );
}
