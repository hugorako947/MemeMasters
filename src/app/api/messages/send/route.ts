import { NextResponse } from "next/server";
import { progressChallenge } from "@/lib/server/challenges";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { MESSAGE_RULES, sendMessage } from "@/lib/server/messages";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Envoie un message privé. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.messageSend, player.id))) throw new ApiError(429, "rate_limited");
  const { to, body } = await readJson(request, z.object({ to: z.string().trim().min(3).max(20), body: z.string().trim().min(1).max(MESSAGE_RULES.MAX_LENGTH) }));
  const message = await sendMessage(player, to, body);
  await progressChallenge(player, "send_messages", 1);
  return NextResponse.json(message, { status: 201 });
});
