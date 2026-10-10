import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { hideConversation } from "@/lib/server/messages";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Supprime une conversation de sa liste (l'autre joueur la garde). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.messageSend, player.id))) throw new ApiError(429, "rate_limited");
  const { username } = await readJson(request, z.object({ username: z.string().trim().min(3).max(20) }));
  await hideConversation(player, username);
  return NextResponse.json({ ok: true });
});
