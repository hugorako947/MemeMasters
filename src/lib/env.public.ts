/**
 * Variables publiques (exposées au navigateur). Elles doivent être lues avec
 * leur nom complet et littéral pour que Next.js les injecte au build.
 */
/** Clés de test officielles de Cloudflare Turnstile : visibles, toujours validées. */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /**
   * Clé publique Cloudflare Turnstile (anti-robot). En développement, sans clé,
   * on utilise la clé de test officielle de Cloudflare (le captcha s'affiche et passe toujours).
   */
  turnstileSiteKey:
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    (process.env.NODE_ENV !== "production" ? TURNSTILE_TEST_SITE_KEY : ""),
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Problèmes de configuration publique, avec un message qui nomme la variable fautive. */
export function supabasePublicEnvProblem(): string | null {
  const { supabaseUrl, supabasePublishableKey } = publicEnv;
  if (!supabaseUrl) return "NEXT_PUBLIC_SUPABASE_URL est vide dans .env.local (voir .env.example).";
  if (!isHttpUrl(supabaseUrl)) {
    return `NEXT_PUBLIC_SUPABASE_URL n'est pas une adresse valide : « ${supabaseUrl} ». Attendu : https://<identifiant>.supabase.co, sans guillemets ni espaces.`;
  }
  if (!supabasePublishableKey) return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est vide dans .env.local (voir .env.example).";
  return null;
}

export function assertSupabasePublicEnv(): { url: string; key: string } {
  const problem = supabasePublicEnvProblem();
  if (problem) throw new Error(`Configuration invalide : ${problem}`);
  return { url: publicEnv.supabaseUrl, key: publicEnv.supabasePublishableKey };
}
