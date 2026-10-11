import { NextResponse } from "next/server";
import { withErrors } from "@/lib/server/http";
import { playerCounts } from "@/lib/server/presence";

/** Nombre de comptes et de joueurs en ligne (public, mis en cache). */
export const GET = withErrors(async () => {
  return NextResponse.json(await playerCounts(), { headers: { "cache-control": "public, max-age=30" } });
});
