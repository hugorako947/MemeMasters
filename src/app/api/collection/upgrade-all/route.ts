import { NextResponse } from "next/server";
import { progressChallenge } from "@/lib/server/challenges";
import { apiPlayer } from "@/lib/server/auth";
import { upgradeAllCards } from "@/lib/server/duplicates";
import { ApiError, assertSameOrigin, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** « Tout faire évoluer » : chaque carte monte aussi haut que ses exemplaires en trop le permettent. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.collection, player.id))) throw new ApiError(429, "rate_limited");
  const result = await upgradeAllCards(player);
  await progressChallenge(player, "evolve_card", result.evolutions);
  return NextResponse.json(result);
});
