import { NextResponse } from "next/server";
import { progressChallenge } from "@/lib/server/challenges";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { upgradeCard } from "@/lib/server/duplicates";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Fait évoluer une carte d'un niveau : ★, ★★, ★★★, puis Divine (exemplaires selon la rareté). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.collection, player.id))) throw new ApiError(429, "rate_limited");
  const { cardId } = await readJson(request, z.object({ cardId: z.uuid() }));
  const result = await upgradeCard(player, cardId);
  await progressChallenge(player, "evolve_card", 1);
  return NextResponse.json(result);
});
