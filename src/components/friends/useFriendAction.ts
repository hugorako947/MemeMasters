"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { postJson } from "@/lib/client/api";
import { useErrorText } from "@/lib/client/errors";

/** Message de confirmation de chaque action d'amitié ou de blocage. */
function successKey(path: string, body: unknown) {
  if (path.endsWith("/friends/request")) return "friendRequested";
  if (path.endsWith("/friends/respond")) return (body as { accept?: boolean }).accept ? "friendAccepted" : "friendDeclined";
  if (path.endsWith("/friends/remove")) return "friendRemoved";
  if (path.endsWith("/moderation/block")) return "playerBlocked";
  if (path.endsWith("/moderation/unblock")) return "playerUnblocked";
  return "done";
}

/** Envoie une action d'amitié, confirme sa réussite ou explique l'erreur, puis rafraîchit la page. */
export function useFriendAction() {
  const errorText = useErrorText();
  const tf = useTranslations("feedback");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(id: string, path: string, body: unknown): Promise<boolean> {
    setPending(id);
    setError(null);
    const res = await postJson(path, body);
    setPending(null);
    if (!res.ok) {
      setError(errorText(res.code));
      toast.error(errorText(res.code));
      return false;
    }
    toast.success(tf(successKey(path, body)));
    router.refresh();
    return true;
  }
  return { act, pending, error };
}
