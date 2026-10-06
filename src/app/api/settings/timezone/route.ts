import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiPlayer } from "@/lib/server/auth";
import { changeTimezone } from "@/lib/server/players";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { timeZoneSchema } from "@/lib/validation/auth";

/** Change le fuseau du joueur (une fois par période de recharge). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await apiPlayer();
  if (!(await consumeRateLimit(RATE_LIMITS.timezone, user.id))) throw new ApiError(429, "rate_limited");
  const { timezone } = await readJson(request, z.object({ timezone: timeZoneSchema }));
  await changeTimezone(user.id, timezone);
  return NextResponse.json({ ok: true });
});
