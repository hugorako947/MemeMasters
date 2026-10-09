import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { sendRequest } from "@/lib/server/friends";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Envoie une demande d'ami (acceptée directement si l'autre en avait déjà envoyé une). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.friendsRequest, player.id))) throw new ApiError(429, "rate_limited");
  const { username } = await readJson(request, z.object({ username: z.string().trim().min(3).max(20) }));
  return NextResponse.json(await sendRequest(player, username));
});
