import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { upgradeCard } from "@/lib/server/duplicates";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Améliore une carte : Dorée (5 doublons), puis Divine (10 doublons). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.collection, player.id))) throw new ApiError(429, "rate_limited");
  const { cardId } = await readJson(request, z.object({ cardId: z.uuid() }));
  return NextResponse.json(await upgradeCard(player, cardId));
});
