import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { ApiError, withErrors } from "@/lib/server/http";
import { getThread } from "@/lib/server/messages";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Une conversation (les messages reçus sont marqués comme lus). */
export const GET = withErrors(async (request: Request) => {
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.messageRead, player.id))) throw new ApiError(429, "rate_limited");
  const username = new URL(request.url).searchParams.get("avec")?.slice(0, 20) ?? "";
  if (!username) throw new ApiError(400, "invalid_input");
  return NextResponse.json(await getThread(player, username));
});
