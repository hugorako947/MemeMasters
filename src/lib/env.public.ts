/**
 * Variables publiques (exposées au navigateur). Elles doivent être lues avec
 * leur nom complet et littéral pour que Next.js les injecte au build.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function assertSupabasePublicEnv(): { url: string; key: string } {
  const { supabaseUrl, supabasePublishableKey } = publicEnv;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requis (voir .env.example).",
    );
  }
  return { url: supabaseUrl, key: supabasePublishableKey };
}
