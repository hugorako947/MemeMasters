import "server-only";
import postgres from "postgres";
import { serverEnv } from "./env";

/**
 * Connexion Postgres du serveur, pour les transactions de jeu (verrous de
 * ligne, tout-ou-rien). Elle contourne RLS : chaque fonction qui l'utilise
 * doit vérifier elle-même l'identité et les droits du joueur.
 *
 * En production, DATABASE_URL pointe vers le pooler Supabase en mode
 * « transaction » (port 6543), d'où `prepare: false`.
 */
type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { __mmSql?: Sql };

export function sql(): Sql {
  if (!globalForDb.__mmSql) {
    globalForDb.__mmSql = postgres(serverEnv().DATABASE_URL, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });
  }
  return globalForDb.__mmSql;
}

/** Codes d'erreur Postgres utilisés par l'application. */
export const PG_UNIQUE_VIOLATION = "23505";

export function isPgError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}
