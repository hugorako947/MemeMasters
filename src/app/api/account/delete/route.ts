import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiUser } from "@/lib/server/auth";
import { deleteAccount, getPlayer } from "@/lib/server/players";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Suppression définitive du compte. Le joueur doit retaper son pseudo :
 * une seconde vérification, côté serveur, de la confirmation affichée à l'écran.
 */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!(await consumeRateLimit(RATE_LIMITS.accountDeletion, user.id))) throw new ApiError(429, "rate_limited");
  const { confirmUsername } = await readJson(request, z.object({ confirmUsername: z.string().max(40) }));
  const player = await getPlayer(user.id);
  if (player && confirmUsername.trim().toLowerCase() !== player.username.toLowerCase()) {
    throw new ApiError(400, "delete_confirmation");
  }
  await deleteAccount(user.id);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
});
