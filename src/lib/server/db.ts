import "server-only";
import postgres from "postgres";
import { serverEnv } from "./env";

/**
 * Connexion Postgres du serveur, pour les transactions de jeu (verrous de
 * ligne, tout-ou-rien). Elle contourne RLS : chaque fonction qui l'utilise
 * doit vérifier elle-même l'identité et les droits du joueur.
 *
 * DATABASE_URL pointe vers le pooler Supabase. Il est utilisé en mode « session »
 * (port 5432) : en mode « transaction » (port 6543), le pooler perd des réponses
 * quand plusieurs requêtes arrivent en même temps sur une connexion, et les pages
 * restaient bloquées sur l'écran de chargement. Une adresse en 6543 est donc
 * convertie automatiquement. `prepare: false` reste compatible avec les deux modes.
 * Ne pas ajouter `max_pipeline` : toute limite empêche postgres.js de réserver la
 * connexion d'une transaction (erreur UNSAFE_TRANSACTION).
 */
type Sql = postgres.Sql;

/** Pooler Supabase en mode transaction (6543) → même pooler en mode session (5432). */
export function sessionPoolerUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "6543") {
      u.port = "5432";
      return u.toString();
    }
  } catch {
    // Adresse illisible : serverEnv() l'a déjà refusée, rien à convertir.
  }
  return url;
}

const globalForDb = globalThis as unknown as { __mmSql?: Sql };

export function sql(): Sql {
  if (!globalForDb.__mmSql) {
    globalForDb.__mmSql = postgres(sessionPoolerUrl(serverEnv().DATABASE_URL), {
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
export const PG_UNDEFINED_TABLE = "42P01";

const warned = new Set<string>();

/**
 * Lecture d'une fonctionnalité dont la table vient d'une migration récente :
 * si la migration n'est pas encore appliquée, on renvoie `fallback` (et on
 * l'écrit une fois dans la console du serveur) au lieu de faire planter la page.
 */
export async function withMissingTable<T>(feature: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isPgError(error, PG_UNDEFINED_TABLE)) throw error;
    if (!warned.has(feature)) {
      warned.add(feature);
      console.warn(`[db] ${feature} indisponible : migration non appliquée (lancez « supabase db push »).`);
    }
    return fallback;
  }
}

export function isPgError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}
