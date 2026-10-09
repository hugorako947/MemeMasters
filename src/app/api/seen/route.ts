import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { markSeen, SEEN_KEYS } from "@/lib/server/notifications";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Marque une notification comme vue (la valeur est calculée par le serveur). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.seen, player.id))) throw new ApiError(429, "rate_limited");
  const { key } = await readJson(request, z.object({ key: z.enum(SEEN_KEYS) }));
  await markSeen(player, key);
  return NextResponse.json({ ok: true });
});
