import { NextResponse, type NextRequest } from "next/server";
import { ApiError, withErrors } from "@/lib/server/http";
import { apiUser } from "@/lib/server/auth";
import { isUsernameTaken } from "@/lib/server/players";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { usernameProblem } from "@/lib/validation/username";

/** Disponibilité d'un pseudo (réservé aux comptes connectés, limité en débit). */
export const GET = withErrors(async (request: NextRequest) => {
  const user = await apiUser();
  if (!(await consumeRateLimit(RATE_LIMITS.usernameCheck, user.id))) throw new ApiError(429, "rate_limited");
  const username = request.nextUrl.searchParams.get("u") ?? "";
  const problem = usernameProblem(username);
  if (problem) return NextResponse.json({ available: false, problem });
  return NextResponse.json({ available: !(await isUsernameTaken(username.trim())) });
});
