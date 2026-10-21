import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { withdraw } from "@/lib/server/community";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** L'auteur retire sa proposition. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.communityVote, player.id))) throw new ApiError(429, "rate_limited");
  const { cardId } = await readJson(request, z.object({ cardId: z.uuid() }));
  await withdraw(player, cardId);
  return NextResponse.json({ ok: true });
});
