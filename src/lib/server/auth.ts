import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "./http";
import { getPlayer, type Player } from "./players";

export interface AuthUser {
  id: string;
  email: string | null;
  isAdmin: boolean;
}

/**
 * Utilisateur connecté, d'après un jeton dont la signature est vérifiée
 * (getClaims). Mis en cache pour la durée de la requête.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; app_metadata?: { role?: string } };
  return {
    id: claims.sub,
    email: claims.email ?? null,
    isAdmin: claims.app_metadata?.role === "admin",
  };
});

/** Chemin demandé, transmis par src/proxy.ts (pour revenir après connexion). */
async function currentPath(): Promise<string> {
  return (await headers()).get("x-mm-path") ?? "/";
}

/** Pages : exige une session, sinon redirige vers /connexion. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect(`/connexion?suivant=${encodeURIComponent(await currentPath())}`);
  return user;
}

/**
 * Pages : exige une session, un profil créé et des conditions acceptées
 * dans leur version actuelle ; sinon /bienvenue.
 */
export async function requirePlayer(): Promise<{ user: AuthUser; player: Player }> {
  const user = await requireUser();
  const player = await getPlayer(user.id);
  if (!player || !player.consentUpToDate) redirect("/bienvenue");
  return { user, player };
}

/** Routes API : exige une session, sinon 401. */
export async function apiUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new ApiError(401, "unauthenticated");
  return user;
}

/** Routes API : exige un profil créé et des conditions à jour, sinon 403. */
export async function apiPlayer(): Promise<{ user: AuthUser; player: Player }> {
  const user = await apiUser();
  const player = await getPlayer(user.id);
  if (!player) throw new ApiError(403, "profile_required");
  if (!player.consentUpToDate) throw new ApiError(403, "consent_required");
  return { user, player };
}
