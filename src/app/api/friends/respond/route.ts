import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { respondRequest } from "@/lib/server/friends";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Accepte ou refuse une demande d'ami reçue. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.friendsAction, player.id))) throw new ApiError(429, "rate_limited");
  const { requestId, accept } = await readJson(request, z.object({ requestId: z.uuid(), accept: z.boolean() }));
  await respondRequest(player, requestId, accept);
  return NextResponse.json({ ok: true });
});
