import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabasePublicEnv } from "@/lib/env.public";

/**
 * Client Supabase côté serveur, lié aux cookies de la requête.
 * Dans un Server Component, l'écriture des cookies est impossible : le
 * rafraîchissement de session est alors assuré par src/proxy.ts.
 */
export async function createSupabaseServerClient() {
  // cookies() d'abord : il marque la page comme dynamique (jamais pré-rendue au build).
  const cookieStore = await cookies();
  const { url, key } = assertSupabasePublicEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appel depuis un Server Component : sans effet, le proxy s'en charge.
        }
      },
    },
  });
}
