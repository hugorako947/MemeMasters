"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FriendButton } from "@/components/friends/FriendButton";
import { useFriendAction } from "@/components/friends/useFriendAction";
import { FormMessage } from "@/components/ui/Field";
import type { Relation } from "@/lib/server/friends";
import { ReportButton } from "./ReportButton";

/**
 * Sur le profil d'un autre joueur : amitié, message, signalement et blocage.
 * Un joueur bloqué ne peut plus nous écrire ni nous envoyer de demande d'ami.
 */
export function PlayerActions({
  relation,
  target,
  blockedByMe,
  myUsername,
}: {
  relation: Relation;
  target: { id: string; username: string };
  blockedByMe: boolean;
  myUsername: string;
}) {
  const t = useTranslations("block");
  const tm = useTranslations("messages");
  const { act, pending, error } = useFriendAction();
  const [confirm, setConfirm] = useState(false);
  const busy = pending !== null;

  if (blockedByMe) {
    return (
      <div className="grid justify-items-start gap-2">
        <p className="text-sm font-semibold text-ink-soft">{t("isBlocked")}</p>
        <button type="button" disabled={busy} onClick={() => act(target.id, "/api/moderation/unblock", { playerId: target.id })} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
          {t("unblock")}
        </button>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </div>
    );
  }

  return (
    <div className="grid justify-items-start gap-3">
      <FriendButton relation={relation} target={target} />
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/profil/${encodeURIComponent(myUsername)}?vue=messages&avec=${encodeURIComponent(target.username)}`}
          className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm"
        >
          {tm("write")}
        </Link>
        <ReportButton playerId={target.id} />
        {confirm ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t("confirmText")}</span>
            <button type="button" disabled={busy} onClick={() => act(target.id, "/api/moderation/block", { playerId: target.id })} className="mm-btn mm-btn--danger min-h-10 px-4 text-sm">
              {t("confirm")}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
              {t("cancel")}
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="mm-btn mm-btn--ghost min-h-10 px-3 text-sm">
            {t("block")}
          </button>
        )}
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}

/** Liste des joueurs bloqués (onglet Amis), pour pouvoir les débloquer. */
export function BlockedList({ players }: { players: Array<{ id: string; username: string }> }) {
  const t = useTranslations("block");
  const { act, pending } = useFriendAction();
  if (players.length === 0) return null;
  return (
    <section className="grid gap-2 rounded-[1.5rem] border-2 border-ink bg-surface p-5">
      <h3 className="font-extrabold">{t("listTitle", { count: players.length })}</h3>
      <ul className="grid gap-1.5">
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2">
            <span className="font-bold">{p.username}</span>
            <button type="button" disabled={pending === p.id} onClick={() => act(p.id, "/api/moderation/unblock", { playerId: p.id })} className="mm-btn mm-btn--ghost min-h-10 px-3 text-sm">
              {t("unblock")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
