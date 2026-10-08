import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiPlayer } from "@/lib/server/auth";
import { openBooster } from "@/lib/server/boosters";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { BOOSTER_KINDS } from "@/lib/economy/boosters";

/** Ouvre un booster. Le tirage est fait et enregistré ici ; le navigateur ne fait qu'animer le résultat. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.boosterOpen, player.id))) throw new ApiError(429, "rate_limited");
  const { kind } = await readJson(request, z.object({ kind: z.enum(BOOSTER_KINDS) }));
  return NextResponse.json(await openBooster(player, kind));
});
