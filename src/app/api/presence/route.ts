import { NextResponse } from "next/server";
import { apiPlayer } from "@/lib/server/auth";
import { assertSameOrigin, withErrors } from "@/lib/server/http";
import { touchPresence } from "@/lib/server/presence";

/** Signal « je suis en ligne », envoyé chaque minute tant que le jeu est ouvert. */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const { player } = await apiPlayer();
  await touchPresence(player.id);
  return NextResponse.json({ ok: true });
});
