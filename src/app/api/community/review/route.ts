import { NextResponse } from "next/server";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { review } from "@/lib/server/community";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

/** Équipe (admins et Super Admin) : soumet une proposition au vote, ou la refuse avec un motif. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (player.role === "player") throw new ApiError(403, "forbidden");
  if (!(await consumeRateLimit(RATE_LIMITS.communityReview, player.id))) throw new ApiError(429, "rate_limited");
  const d = await readJson(request, z.object({ cardId: z.uuid(), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(200).optional() }));
  await review(player, d.cardId, d.decision, d.reason || null);
  return NextResponse.json({ ok: true });
});
