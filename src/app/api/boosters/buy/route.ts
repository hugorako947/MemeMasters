import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiPlayer } from "@/lib/server/auth";
import { buyBooster } from "@/lib/server/boosters";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Achète un booster en plus, un Super Booster ou un Ultra Booster avec de la MemeMoney. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.boosterBuy, player.id))) throw new ApiError(429, "rate_limited");
  const { item } = await readJson(request, z.object({ item: z.enum(["extra", "special", "very_special"]) }));
  await buyBooster(player, item);
  return NextResponse.json({ ok: true });
});
