"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/Toast";

/**
 * Confirme le résultat de la dernière action (bulle) puis retire le message de
 * l'adresse : recharger la page ne le réaffiche pas.
 */
export function AdminFlash({ ok, error }: { ok: string; error: string }) {
  const shown = useRef("");
  useEffect(() => {
    const key = ok + "|" + error;
    if (!ok && !error) return;
    if (shown.current === key) return;
    shown.current = key;
    if (ok) toast.success(ok);
    if (error) toast.error(error);
    const url = new URL(window.location.href);
    url.searchParams.delete("ok");
    url.searchParams.delete("erreur");
    window.history.replaceState(window.history.state, "", url);
  }, [ok, error]);
  return null;
}
