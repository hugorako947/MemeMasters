"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { RankShield, TrophyIcon } from "@/components/player/RankBadge";
import { FormMessage } from "@/components/ui/Field";
import { rankFor } from "@/config/ranks";
import type { FriendLite, FriendsOverview, Relation } from "@/lib/server/friends";
import { useFriendAction } from "./useFriendAction";

type SearchResult = FriendLite & { relation: Relation["kind"] };

/**
 * Amis du joueur, sur son propre profil : rechercher un joueur par pseudo,
 * répondre aux demandes reçues, suivre les demandes envoyées, voir et retirer ses amis.
 */
export function FriendsPanel({ overview }: { overview: FriendsOverview }) {
  const t = useTranslations("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const { act, pending, error } = useFriendAction();

  // Recherche au fil de la frappe (300 ms après la dernière touche).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) setResults((await res.json()).results);
      } catch {
        /* recherche annulée */
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function add(r: SearchResult) {
    if (await act(r.id, "/api/friends/request", { username: r.username })) {
      setResults((list) => list.map((x) => (x.id === r.id ? { ...x, relation: r.relation === "incoming" ? "friends" : "outgoing" } : x)));
    }
  }

  const shown = query.trim().length >= 2 ? results : [];

  return (
    <section className="grid gap-5 rounded-[1.5rem] border-2 border-ink bg-surface p-5 shadow-[0_3px_0_0_var(--mm-shadow)]" aria-labelledby="amis">
      <h2 id="amis" className="font-display text-3xl leading-none">
        {t("title", { count: overview.friends.length })}
      </h2>

      {/* Recherche */}
      <div className="grid gap-2">
        <label htmlFor="friend-search" className="text-sm font-bold">
          {t("searchLabel")}
        </label>
        <input
          id="friend-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="min-h-11 rounded-full border-2 border-ink bg-surface px-4"
        />
        {query.trim().length >= 2 && shown.length === 0 ? <p className="text-sm text-ink-soft">{t("noResult")}</p> : null}
        <ul className="grid gap-1.5">
          {shown.map((r) => (
            <PlayerRow key={r.id} player={r}>
              {r.relation === "friends" ? (
                <span className="text-sm font-bold text-ink-soft">{t("status.friends")}</span>
              ) : r.relation === "outgoing" ? (
                <span className="text-sm font-bold text-ink-soft">{t("status.outgoing")}</span>
              ) : (
                <button type="button" onClick={() => add(r)} disabled={pending === r.id} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
                  {r.relation === "incoming" ? t("accept") : t("add")}
                </button>
              )}
            </PlayerRow>
          ))}
        </ul>
      </div>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {/* Demandes reçues */}
      {overview.incoming.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="font-extrabold">{t("incoming", { count: overview.incoming.length })}</h3>
          <ul className="grid gap-1.5">
            {overview.incoming.map((r) => (
              <PlayerRow key={r.requestId} player={r.from} highlight>
                <span className="flex gap-2">
                  <button type="button" disabled={pending === r.requestId} onClick={() => act(r.requestId, "/api/friends/respond", { requestId: r.requestId, accept: true })} className="mm-btn mm-btn--primary min-h-10 px-4 text-sm">
                    {t("accept")}
                  </button>
                  <button type="button" disabled={pending === r.requestId} onClick={() => act(r.requestId, "/api/friends/respond", { requestId: r.requestId, accept: false })} className="mm-btn mm-btn--secondary min-h-10 px-4 text-sm">
                    {t("decline")}
                  </button>
                </span>
              </PlayerRow>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Demandes envoyées */}
      {overview.outgoing.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="font-extrabold">{t("outgoing", { count: overview.outgoing.length })}</h3>
          <ul className="grid gap-1.5">
            {overview.outgoing.map((r) => (
              <PlayerRow key={r.requestId} player={r.to}>
                <button type="button" disabled={pending === r.to.id} onClick={() => act(r.to.id, "/api/friends/remove", { playerId: r.to.id })} className="mm-btn mm-btn--ghost min-h-10 px-3 text-sm">
                  {t("cancel")}
                </button>
              </PlayerRow>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Amis */}
      <div className="grid gap-2">
        <h3 className="font-extrabold">{t("list")}</h3>
        {overview.friends.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("empty")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {overview.friends.map((f) => (
              <PlayerRow key={f.id} player={f}>
                {confirmRemove === f.id ? (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => act(f.id, "/api/friends/remove", { playerId: f.id }).then(() => setConfirmRemove(null))} className="mm-btn mm-btn--danger min-h-10 px-3 text-sm">
                      {t("confirmRemove")}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="mm-btn mm-btn--secondary min-h-10 px-3 text-sm">
                      {t("keep")}
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(f.id)} className="mm-btn mm-btn--ghost min-h-10 px-3 text-sm">
                    {t("remove")}
                  </button>
                )}
              </PlayerRow>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PlayerRow({ player, highlight = false, children }: { player: FriendLite; highlight?: boolean; children: React.ReactNode }) {
  const format = useFormatter();
  const rank = rankFor(player.trophies);
  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2 ${highlight ? "border-2 border-candy bg-[color-mix(in_srgb,var(--color-candy),transparent_90%)]" : "bg-paper"}`}>
      <Link href={`/profil/${encodeURIComponent(player.username)}`} className="flex min-h-10 min-w-0 items-center gap-2.5 font-bold hover:underline">
        <RankShield rank={rank} size={26} />
        <span className="truncate">{player.username}</span>
        <span className="flex items-center gap-1 text-sm font-semibold text-ink-soft">
          <TrophyIcon size={13} />
          {format.number(player.trophies)}
        </span>
      </Link>
      {children}
    </li>
  );
}
