import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { searchPlayers } from "@/lib/server/friends";
import { ApiError, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Recherche de joueurs par début de pseudo. */
export const GET = withErrors(async (request: Request) => {
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.friendsSearch, player.id))) throw new ApiError(429, "rate_limited");
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 20) ?? "";
  return NextResponse.json({ results: await searchPlayers(player.id, q) });
});
