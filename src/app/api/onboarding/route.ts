import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiUser } from "@/lib/server/auth";
import { createPlayer } from "@/lib/server/players";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { onboardingSchema } from "@/lib/validation/auth";
import { usernameProblem } from "@/lib/validation/username";

/** Crée le profil d'un compte Google : pseudo, fuseau, majorité et conditions. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!(await consumeRateLimit(RATE_LIMITS.onboarding, user.id))) throw new ApiError(429, "rate_limited");

  const raw = await readJson(
    request,
    z.object({ username: z.string(), timezone: z.string(), adult: z.unknown(), terms: z.unknown() }),
  );
  const problem = usernameProblem(raw.username);
  if (problem) throw new ApiError(400, `username_${problem}`);
  if (raw.adult !== true) throw new ApiError(400, "adult_required");
  if (raw.terms !== true) throw new ApiError(400, "terms_required");
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "timezone");

  await createPlayer(user.id, parsed.data.username, parsed.data.timezone);
  return NextResponse.json({ ok: true }, { status: 201 });
});
