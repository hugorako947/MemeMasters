import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, withErrors } from "@/lib/server/http";
import { listConversations } from "@/lib/server/messages";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Liste des conversations du joueur. */
export const GET = withErrors(async () => {
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.messageRead, player.id))) throw new ApiError(429, "rate_limited");
  return NextResponse.json({ conversations: await listConversations(player.id) });
});
