import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { claimChallenge } from "@/lib/server/challenges";
import { ApiError, assertSameOrigin, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Récupère la récompense du défi du jour. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.collection, player.id))) throw new ApiError(429, "rate_limited");
  return NextResponse.json(await claimChallenge(player));
});
