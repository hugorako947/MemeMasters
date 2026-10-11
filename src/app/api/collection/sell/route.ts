import { NextResponse } from "next/server";
import { progressChallenge } from "@/lib/server/challenges";
import { z } from "zod";
import { apiPlayer } from "@/lib/server/auth";
import { sellCards } from "@/lib/server/duplicates";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

const schema = z.object({
  lines: z
    .array(z.object({ cardId: z.uuid(), count: z.number().int().min(1).max(10_000) }))
    .min(1)
    .max(500)
    .refine((lines) => new Set(lines.map((l) => l.cardId)).size === lines.length),
});

/** Revend des cartes contre de la MemeMoney (prix bas, plafond quotidien). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.collection, player.id))) throw new ApiError(429, "rate_limited");
  const { lines } = await readJson(request, schema);
  const result = await sellCards(player, lines);
  await progressChallenge(player, "sell_copies", lines.reduce((n, l) => n + l.count, 0));
  return NextResponse.json(result);
});
