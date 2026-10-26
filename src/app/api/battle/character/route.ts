import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { chooseBattleCharacter } from "@/lib/server/battle";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Choisit le personnage du Battle Royale (une carte possédée de la collection). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.battleCharacter, player.id))) throw new ApiError(429, "rate_limited");
  const { cardId } = await readJson(request, z.object({ cardId: z.uuid() }));
  return NextResponse.json(await chooseBattleCharacter(player, cardId));
});
