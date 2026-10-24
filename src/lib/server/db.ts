import "server-only";
import postgres from "postgres";
import { serverEnv } from "./env";

/**
 * Connexion Postgres du serveur, pour les transactions de jeu (verrous de
 * ligne, tout-ou-rien). Elle contourne RLS : chaque fonction qui l'utilise
 * doit vérifier elle-même l'identité et les droits du joueur.
 *
 * DATABASE_URL pointe vers le pooler Supabase, utilisé en mode « transaction »
 * (port 6543), le seul adapté à Vercel : chaque instance garde ses connexions,
 * même endormie. En mode « session » (5432), le pooler n'accepte que 15 clients
 * en tout (mesuré le 2026-10-24) : quelques instances suffisaient à le saturer, et
 * chaque page qui lisait la base plantait (« Oups, cette page a planté »). Une
 * adresse en 5432 est donc convertie automatiquement.
 *
 * Le mode transaction perd des réponses quand plusieurs requêtes partent en rafale
 * sur une même connexion (pages bloquées sur l'écran de chargement). D'où deux
 * groupes de connexions :
 * - les requêtes isolées : une seule à la fois par connexion (`max_pipeline: 0`) ;
 * - les transactions (`sql().begin`) : connexions à part, car `max_pipeline: 0`
 *   empêche postgres.js de réserver la connexion d'une transaction (erreur
 *   UNSAFE_TRANSACTION). À l'intérieur d'une transaction, le pooler garde la même
 *   connexion du début à la fin : l'envoi en rafale y est sans danger.
 * Vérifié sous charge sur le vrai pooler : 1 000 requêtes simultanées (avec et sans
 * paramètre, transactions comprises), toutes justes, aucune bloquée ; avec un seul
 * groupe en rafale, 193 sur 300 restaient bloquées.
 */
type Sql = postgres.Sql;

/** Pooler Supabase en mode session (5432) → même pooler en mode transaction (6543). */
export function transactionPoolerUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "5432") {
      u.port = "6543";
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
    const url = transactionPoolerUrl(serverEnv().DATABASE_URL);
    const options = { prepare: false, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} } as const;
    // `max_pipeline` est bien lu par postgres.js (src/index.js), mais absent de ses types.
    const oneAtATime = { ...options, max: 5, max_pipeline: 0 };
    const queries = postgres(url, oneAtATime);
    const transactions = postgres(url, { ...options, max: 3 });
    queries.begin = transactions.begin;
    globalForDb.__mmSql = queries;
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
