import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { unblockPlayer } from "@/lib/server/moderation";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Débloque un joueur. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.friendsAction, player.id))) throw new ApiError(429, "rate_limited");
  const { playerId } = await readJson(request, z.object({ playerId: z.uuid() }));
  await unblockPlayer(player, playerId);
  return NextResponse.json({ ok: true });
});
