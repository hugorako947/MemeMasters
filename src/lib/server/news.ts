import "server-only";
import type { Localized, NewsKind } from "@/lib/news";
import { sql } from "./db";

export interface NewsItem {
  id: string;
  publishedAt: string;
  kind: NewsKind;
  title: Localized;
  body: Localized;
}

/** News publiées, de la plus récente à la plus ancienne (gérées depuis le tableau de bord). */
export async function listNews(limit = 30): Promise<NewsItem[]> {
  const rows = await sql()<{ id: string; published_at: Date; kind: NewsKind; title: Localized; body: Localized }[]>`
    select id, published_at, kind, title, body from public.news
    where published_at <= now() order by published_at desc limit ${limit}
  `;
  return rows.map((r) => ({ id: r.id, publishedAt: r.published_at.toISOString(), kind: r.kind, title: r.title, body: r.body }));
}

/** Date de la dernière news publiée (ISO), pour les notifications. */
export async function latestNewsAt(): Promise<string> {
  const [r] = await sql()<{ at: Date | null }[]>`select max(published_at) as at from public.news where published_at <= now()`;
  return r?.at ? r.at.toISOString() : "";
}

/** Nombre de news publiées après la dernière consultation du joueur. */
export async function unreadNewsCount(seenAt: string | undefined): Promise<number> {
  const since = seenAt && !Number.isNaN(Date.parse(seenAt)) ? new Date(seenAt) : null;
  const [r] = await sql()<{ n: number }[]>`
    select count(*)::int as n from public.news
    where published_at <= now() and (${since}::timestamptz is null or date_trunc('milliseconds', published_at) > ${since}::timestamptz)
  `;
  return r.n;
}
