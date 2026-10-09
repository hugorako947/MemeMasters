"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { postJson } from "@/lib/client/api";

/** Envoie une action d'amitié, affiche l'erreur éventuelle et rafraîchit la page. */
export function useFriendAction() {
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(id: string, path: string, body: unknown): Promise<boolean> {
    setPending(id);
    setError(null);
    const res = await postJson(path, body);
    setPending(null);
    if (!res.ok) {
      setError(te(res.code as "server_error"));
      return false;
    }
    router.refresh();
    return true;
  }
  return { act, pending, error };
}
