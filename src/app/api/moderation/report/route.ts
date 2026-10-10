import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { reportPlayer, reportSchema } from "@/lib/server/moderation";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Signale un joueur à l'équipe (le signalement est enregistré, traité depuis Supabase). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.report, player.id))) throw new ApiError(429, "rate_limited");
  await reportPlayer(player, await readJson(request, reportSchema));
  return NextResponse.json({ ok: true });
});
