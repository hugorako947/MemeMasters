import { NextResponse, type NextRequest } from "next/server";
import { ApiError, withErrors } from "@/lib/server/http";
import { isUsernameTaken } from "@/lib/server/players";
import { clientIp, consumeRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { usernameProblem } from "@/lib/validation/username";

/**
 * Disponibilité d'un pseudo, utilisée pendant l'inscription (donc sans compte).
 * Limitée par adresse IP. Les pseudos sont publics : rien de sensible n'est révélé.
 */
export const GET = withErrors(async (request: NextRequest) => {
  if (!(await consumeRateLimit(RATE_LIMITS.usernameCheck, clientIp(request.headers)))) {
    throw new ApiError(429, "rate_limited");
  }
  const username = request.nextUrl.searchParams.get("u") ?? "";
  const problem = usernameProblem(username);
  if (problem) return NextResponse.json({ available: false, problem });
  return NextResponse.json({ available: !(await isUsernameTaken(username.trim())) });
});
