import "server-only";
import type { Card } from "@/lib/validation/card";
import { toCard, type CardRow } from "./cards";
import { sql } from "./db";
import { ONLINE_WINDOW_SECONDS } from "./presence";

/** Trace chaque action d'administration (visible dans le journal du tableau de bord). */
export async function audit(adminId: string, action: string, target: string | null, diff?: unknown): Promise<void> {
  await sql()`
    insert into public.admin_audit_log (admin_id, action, target, diff)
    values (${adminId}, ${action.slice(0, 60)}, ${target ? target.slice(0, 200) : null}, ${diff === undefined ? null : JSON.stringify(diff)}::jsonb)
  `;
}

export async function overview() {
  const [r] = await sql()<
    {
      accounts: number;
      online: number;
      new_24h: number;
      new_7d: number;
      boosters_today: number;
      messages_today: number;
      reports_new: number;
      contact_new: number;
      banned: number;
      admins: number;
      meme_money: number;
    }[]
  >`
    select
      (select count(*) from public.profiles)::int as accounts,
      (select count(*) from public.profiles where last_seen_at > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS}))::int as online,
      (select count(*) from public.profiles where created_at > now() - interval '1 day')::int as new_24h,
      (select count(*) from public.profiles where created_at > now() - interval '7 days')::int as new_7d,
      (select count(*) from public.booster_openings where created_at > now() - interval '1 day')::int as boosters_today,
      (select count(*) from public.messages where created_at > now() - interval '1 day')::int as messages_today,
      (select count(*) from public.player_reports where status = 'new')::int as reports_new,
      (select count(*) from public.contact_messages where status = 'new')::int as contact_new,
      (select count(*) from public.player_private where banned_at is not null)::int as banned,
      (select count(*) from public.player_private where role = 'admin')::int as admins,
      (select coalesce(sum(meme_money), 0) from public.player_wallets)::int as meme_money
  `;
  const recent = await sql()<{ id: string; username: string; created_at: Date }[]>`
    select id, username::text as username, created_at from public.profiles order by created_at desc limit 8
  `;
  return { stats: r, recent };
}

export interface AdminPlayerRow {
  id: string;
  username: string;
  email: string | null;
  trophies: number;
  meme_money: number;
  role: string;
  banned_at: Date | null;
  created_at: Date;
  last_seen_at: Date | null;
}

/** Recherche par pseudo ou e-mail (début ou contenu), 50 résultats. */
export async function searchPlayers(q: string): Promise<AdminPlayerRow[]> {
  const like = `%${q.trim().replace(/[%_\\]/g, "\\$&")}%`;
  return sql()<AdminPlayerRow[]>`
    select p.id, p.username::text as username, u.email, p.trophies, coalesce(w.meme_money, 0) as meme_money,
           pp.role, pp.banned_at, p.created_at, p.last_seen_at
    from public.profiles p
    join public.player_private pp on pp.player_id = p.id
    left join public.player_wallets w on w.player_id = p.id
    left join auth.users u on u.id = p.id
    where ${q.trim() === ""} or p.username ilike ${like} or u.email ilike ${like}
    order by p.created_at desc
    limit 50
  `;
}

export async function playerDetail(id: string) {
  const [p] = await sql()<
    (AdminPlayerRow & {
      highest_rank: number;
      wins: number;
      losses: number;
      draws: number;
      bonus_boosters: number;
      paid_boosters: number;
      special_boosters: number;
      very_special_boosters: number;
      ban_reason: string | null;
      cards: number;
      copies: number;
      friends: number;
    })[]
  >`
    select p.id, p.username::text as username, u.email, p.trophies, p.highest_rank, p.wins, p.losses, p.draws,
           coalesce(w.meme_money, 0) as meme_money, coalesce(w.bonus_boosters, 0) as bonus_boosters,
           coalesce(w.paid_boosters, 0) as paid_boosters, coalesce(w.special_boosters, 0) as special_boosters,
           coalesce(w.very_special_boosters, 0) as very_special_boosters,
           pp.role, pp.banned_at, pp.ban_reason, p.created_at, p.last_seen_at,
           (select count(*) from public.user_cards where player_id = p.id)::int as cards,
           (select coalesce(sum(quantity), 0) from public.user_cards where player_id = p.id)::int as copies,
           (select count(*) from public.friendships where status = 'accepted' and p.id in (requester_id, addressee_id))::int as friends
    from public.profiles p
    join public.player_private pp on pp.player_id = p.id
    left join public.player_wallets w on w.player_id = p.id
    left join auth.users u on u.id = p.id
    where p.id = ${id}
  `;
  if (!p) return null;
  const reports = await sql()<{ id: string; reason: string; details: string | null; status: string; created_at: Date; reporter: string | null }[]>`
    select r.id, r.reason::text as reason, r.details, r.status::text as status, r.created_at, rp.username::text as reporter
    from public.player_reports r left join public.profiles rp on rp.id = r.reporter_id
    where r.reported_id = ${id} order by r.created_at desc limit 20
  `;
  return { ...p, reports };
}

export async function listReports(status: "new" | "handled") {
  return sql()<
    { id: string; reason: string; details: string | null; created_at: Date; reported_id: string; reported: string; reporter: string | null; message_id: string | null }[]
  >`
    select r.id, r.reason::text as reason, r.details, r.created_at, r.reported_id, rd.username::text as reported,
           rp.username::text as reporter, r.message_id
    from public.player_reports r
    join public.profiles rd on rd.id = r.reported_id
    left join public.profiles rp on rp.id = r.reporter_id
    where r.status = ${status}::public.report_status
    order by r.created_at desc limit 100
  `;
}

export async function listContact(status: "new" | "handled") {
  return sql()<{ id: string; email: string; category: string; subject: string | null; message: string; locale: string | null; created_at: Date; username: string | null }[]>`
    select c.id, c.email, c.category::text as category, c.subject, c.message, c.locale, c.created_at, p.username::text as username
    from public.contact_messages c left join public.profiles p on p.id = c.player_id
    where c.status = ${status}::public.contact_status
    order by c.created_at desc limit 100
  `;
}

export async function listAudit() {
  return sql()<{ id: number; action: string; target: string | null; diff: unknown; created_at: Date; admin: string | null }[]>`
    select a.id, a.action, a.target, a.diff, a.created_at, p.username::text as admin
    from public.admin_audit_log a left join public.profiles p on p.id = a.admin_id
    order by a.created_at desc limit 150
  `;
}

/** Toutes les cartes, y compris inactives, pour le tableau de bord. */
export async function adminCards(): Promise<Array<Card & { isActive: boolean; isDroppable: boolean }>> {
  const rows = await sql()<(CardRow & { is_active: boolean; is_droppable: boolean })[]>`
    select id, slug, name, description, rarity, hp, atk, def, spd, normal_attack, special_attack, defense_ability,
           art_seed, image_path, is_active, is_droppable
    from public.cards order by is_active desc, rarity desc, name
  `;
  return rows.map((r) => ({ ...toCard(r), isActive: r.is_active, isDroppable: r.is_droppable }));
}
