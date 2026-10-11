import "server-only";
import { pickTemplate } from "@/lib/economy/challenge-pick";
import { gameDate } from "@/lib/time/game-day";
import { sql } from "./db";
import { ApiError } from "./http";
import type { Player } from "./players";

export const CHALLENGE_TYPES = ["open_boosters", "new_cards", "sell_copies", "evolve_card", "send_messages", "add_friend"] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];
export type Difficulty = "easy" | "medium" | "hard";

export interface DailyChallenge {
  id: string;
  type: ChallengeType;
  difficulty: Difficulty;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

interface Template {
  id: string;
  code: string;
  type: ChallengeType;
  target: number;
  reward_boosters: number;
  weight: number;
  params: { difficulty?: Difficulty };
}

/** Défi du jour du joueur (créé à la première demande de la journée). */
export async function getDailyChallenge(player: Player): Promise<DailyChallenge | null> {
  const day = gameDate(player.timezone);
  let [row] = await sql()<(Template & { pc_id: string; progress: number; pc_target: number; completed_at: Date | null; claimed_at: Date | null })[]>`
    select t.*, pc.id as pc_id, pc.progress, pc.target as pc_target, pc.completed_at, pc.claimed_at
    from public.player_challenges pc join public.challenge_templates t on t.id = pc.template_id
    where pc.player_id = ${player.id} and pc.game_date = ${day}
    limit 1
  `;
  if (!row) {
    const templates = await sql()<Template[]>`select * from public.challenge_templates where is_active order by code`;
    const [yesterday] = await sql()<{ template_id: string }[]>`
      select template_id from public.player_challenges where player_id = ${player.id} and game_date < ${day}
      order by game_date desc limit 1
    `;
    const t = pickTemplate(templates, player.id, day, yesterday?.template_id ?? null);
    if (!t) return null;
    await sql()`
      insert into public.player_challenges (player_id, game_date, template_id, target)
      values (${player.id}, ${day}, ${t.id}, ${t.target})
      on conflict (player_id, game_date, template_id) do nothing
    `;
    [row] = await sql()<(Template & { pc_id: string; progress: number; pc_target: number; completed_at: Date | null; claimed_at: Date | null })[]>`
      select t.*, pc.id as pc_id, pc.progress, pc.target as pc_target, pc.completed_at, pc.claimed_at
      from public.player_challenges pc join public.challenge_templates t on t.id = pc.template_id
      where pc.player_id = ${player.id} and pc.game_date = ${day}
      limit 1
    `;
  }
  return {
    id: row.pc_id,
    type: row.type,
    difficulty: row.params?.difficulty ?? "easy",
    progress: Math.min(row.progress, row.pc_target),
    target: row.pc_target,
    reward: row.reward_boosters,
    completed: row.completed_at !== null,
    claimed: row.claimed_at !== null,
  };
}

/**
 * Fait avancer le défi du jour s'il correspond à l'action (sans erreur si le
 * joueur n'a pas encore de défi aujourd'hui : il sera tiré à sa prochaine visite).
 */
export async function progressChallenge(player: Pick<Player, "id" | "timezone">, type: ChallengeType, amount = 1): Promise<void> {
  if (amount <= 0) return;
  const day = gameDate(player.timezone);
  try {
    await sql()`
      update public.player_challenges pc
      set progress = least(pc.target, pc.progress + ${amount}),
          completed_at = case when pc.progress + ${amount} >= pc.target then coalesce(pc.completed_at, now()) else pc.completed_at end
      from public.challenge_templates t
      where t.id = pc.template_id and pc.player_id = ${player.id} and pc.game_date = ${day}
        and t.type = ${type} and pc.completed_at is null
    `;
  } catch (error) {
    // Un défi ne doit jamais faire échouer l'action du joueur.
    console.error("[défi] progression impossible", error);
  }
}

/** Récupère la récompense du défi terminé : des boosters en plus. */
export async function claimChallenge(player: Player): Promise<{ reward: number }> {
  const day = gameDate(player.timezone);
  return sql().begin(async (tx) => {
    const [c] = await tx<{ id: string; reward: number }[]>`
      select pc.id, t.reward_boosters as reward
      from public.player_challenges pc join public.challenge_templates t on t.id = pc.template_id
      where pc.player_id = ${player.id} and pc.game_date = ${day}
        and pc.completed_at is not null and pc.claimed_at is null
      for update of pc
    `;
    if (!c) throw new ApiError(409, "challenge_not_ready");
    await tx`update public.player_challenges set claimed_at = now() where id = ${c.id}`;
    await tx`update public.player_wallets set bonus_boosters = bonus_boosters + ${c.reward} where player_id = ${player.id}`;
    await tx`
      insert into public.economy_ledger (player_id, kind, bonus_boosters_delta, ref_id, note)
      values (${player.id}, 'challenge_reward', ${c.reward}, ${c.id}, 'défi du jour')
    `;
    return { reward: c.reward };
  });
}

/** Nouvelle amitié : le défi « se faire un ami » avance pour les deux joueurs. */
export async function friendshipChallenge(player: Pick<Player, "id" | "timezone">, otherId: string): Promise<void> {
  await progressChallenge(player, "add_friend", 1);
  const [other] = await sql()<{ timezone: string }[]>`select timezone from public.player_private where player_id = ${otherId}`;
  if (other) await progressChallenge({ id: otherId, timezone: other.timezone }, "add_friend", 1);
}
