"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Fuseau de l'appareil. Côté serveur (et pendant l'hydratation) on renvoie
 * `fallback`, puis React affiche la vraie valeur sans avertissement.
 */
export function useDeviceTimeZone(fallback: string): string {
  return useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || fallback,
    () => fallback,
  );
}
