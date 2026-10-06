import "server-only";
import { sql } from "./db";

export interface RateLimitRule {
  /** Nom de la règle, ex. « onboarding ». */
  scope: string;
  limit: number;
  windowSeconds: number;
}

/** Règles centralisées (conception, section 5). */
export const RATE_LIMITS = {
  signIn: { scope: "sign_in", limit: 10, windowSeconds: 600 },
  signUp: { scope: "sign_up", limit: 5, windowSeconds: 3600 },
  passwordReset: { scope: "password_reset", limit: 5, windowSeconds: 3600 },
  onboarding: { scope: "onboarding", limit: 5, windowSeconds: 60 },
  usernameCheck: { scope: "username_check", limit: 30, windowSeconds: 60 },
  timezone: { scope: "timezone", limit: 5, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * En développement, les limites sont 20 fois plus larges : on teste souvent
 * l'inscription depuis la même adresse. En production, elles s'appliquent telles quelles.
 */
export const RATE_LIMIT_MULTIPLIER = process.env.NODE_ENV === "production" ? 1 : 20;

/**
 * Renvoie vrai si la requête est autorisée. `subject` identifie l'appelant
 * (identifiant de joueur ou adresse IP).
 */
export async function consumeRateLimit(rule: RateLimitRule, subject: string): Promise<boolean> {
  const key = `${rule.scope}:${subject}`.slice(0, 200);
  const limit = rule.limit * RATE_LIMIT_MULTIPLIER;
  const [row] = await sql()<{ allowed: boolean }[]>`
    select public.check_rate_limit(${key}, ${limit}, ${rule.windowSeconds}) as allowed
  `;
  return row?.allowed === true;
}

/** Adresse IP du client derrière le proxy de Vercel. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
