import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { deleteMessage } from "@/lib/server/messages";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Supprime un de ses propres messages. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.messageSend, player.id))) throw new ApiError(429, "rate_limited");
  const { messageId } = await readJson(request, z.object({ messageId: z.uuid() }));
  await deleteMessage(player, messageId);
  return NextResponse.json({ ok: true });
});
