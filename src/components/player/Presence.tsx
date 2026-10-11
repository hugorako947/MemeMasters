"use client";

import { useEffect } from "react";

/** Signale au serveur que le joueur est en ligne, chaque minute tant que le jeu est visible. */
export function Presence() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        fetch("/api/presence", { method: "POST" }).catch(() => undefined);
      }
    };
    const first = setTimeout(ping, 1_000);
    const timer = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
