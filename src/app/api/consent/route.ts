import { NextResponse } from "next/server";
import { ApiError, assertSameOrigin, readJson, withErrors } from "@/lib/server/http";
import { apiUser } from "@/lib/server/auth";
import { recordConsent } from "@/lib/server/players";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { consentSchema } from "@/lib/validation/auth";

/** Nouvelle acceptation des conditions (version actuelle) et attestation de majorité. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const user = await apiUser();
  if (!(await consumeRateLimit(RATE_LIMITS.onboarding, user.id))) throw new ApiError(429, "rate_limited");
  await readJson(request, consentSchema);
  await recordConsent(user.id);
  return NextResponse.json({ ok: true });
});
