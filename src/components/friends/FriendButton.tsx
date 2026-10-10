"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormMessage } from "@/components/ui/Field";
import type { Relation } from "@/lib/server/friends";
import { useFriendAction } from "./useFriendAction";

/** Sur le profil d'un autre joueur : ajouter, accepter, annuler ou retirer l'amitié. */
export function FriendButton({ relation, target }: { relation: Relation; target: { id: string; username: string } }) {
  const t = useTranslations("friends");
  const { act, pending, error } = useFriendAction();
  const [confirming, setConfirming] = useState(false);
  if (relation.kind === "self") return null;
  const busy = pending !== null;
  return (
    <div className="grid justify-items-start gap-2">
      {relation.kind === "none" ? (
        <button type="button" disabled={busy} onClick={() => act(target.id, "/api/friends/request", { username: target.username })} className="mm-btn mm-btn--primary min-h-10 px-5 text-sm">
          {t("add")}
        </button>
      ) : relation.kind === "incoming" ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{t("wantsYou")}</span>
          <button type="button" disabled={busy} onClick={() => act(target.id, "/api/friends/respond", { requestId: relation.requestId, accept: true })} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
            {t("accept")}
          </button>
          <button type="button" disabled={busy} onClick={() => act(target.id, "/api/friends/respond", { requestId: relation.requestId, accept: false })} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
            {t("decline")}
          </button>
        </span>
      ) : relation.kind === "outgoing" ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink-soft">{t("status.outgoing")}</span>
          <button type="button" disabled={busy} onClick={() => act(target.id, "/api/friends/remove", { playerId: target.id })} className="mm-btn mm-btn--ghost min-h-10 px-3 text-sm">
            {t("cancel")}
          </button>
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-paper px-3 py-1 text-sm font-bold">{t("status.friends")}</span>
          {confirming ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => act(target.id, "/api/friends/remove", { playerId: target.id }).then(() => setConfirming(false))}
                className="mm-btn mm-btn--danger min-h-10 px-4 text-sm"
              >
                {t("confirmRemove")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
                {t("keep")}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="mm-btn mm-btn--ghost min-h-10 px-3 text-sm">
              {t("remove")}
            </button>
          )}
        </span>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
