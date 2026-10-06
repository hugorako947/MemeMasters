import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (ex-middleware) : rafraîchit la session Supabase et fait les
 * redirections « optimistes ». La vraie vérification d'accès est refaite
 * côté serveur dans chaque page et route (requirePlayer, apiPlayer…).
 */

/** Pages réservées aux joueurs connectés. */
const PROTECTED_PREFIXES = ["/bienvenue", "/profil", "/parametres", "/nouveau-mot-de-passe"];
/** Pages inutiles une fois connecté. */
const GUEST_ONLY = ["/connexion", "/inscription"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-mm-path", pathname + search);

  const { response, userId } = await updateSession(request, requestHeaders);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suivant=${encodeURIComponent(pathname + search)}`;
    return withCookies(NextResponse.redirect(url), response);
  }
  if (userId && GUEST_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCookies(NextResponse.redirect(url), response);
  }
  return response;
}

/** Une redirection doit conserver les cookies de session éventuellement rafraîchis. */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, le service worker, le manifest et les icônes.
    "/((?!_next/static|_next/image|serwist|manifest.webmanifest|icons|splash|fonts|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
  ],
};
