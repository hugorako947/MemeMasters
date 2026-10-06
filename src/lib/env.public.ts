/**
 * Variables publiques (exposées au navigateur). Elles doivent être lues avec
 * leur nom complet et littéral pour que Next.js les injecte au build.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
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
