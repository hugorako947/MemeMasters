import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { assertSupabasePublicEnv } from "@/lib/env.public";

/**
 * Rafraîchit la session Supabase à chaque navigation et renvoie l'identifiant
 * de l'utilisateur (null si déconnecté ou si Supabase n'est pas configuré).
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  // Message explicite si .env.local est mal rempli (nomme la variable fautive).
  const { url, key } = assertSupabasePublicEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // getClaims vérifie la signature du jeton ; ne jamais se fier à getSession ici.
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return { response, userId: typeof sub === "string" ? sub : null };
}
