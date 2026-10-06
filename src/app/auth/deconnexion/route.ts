import { NextResponse } from "next/server";
import { assertSameOrigin, withErrors } from "@/lib/server/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Déconnexion (POST uniquement, même origine). */
export const POST = withErrors(async (request: Request) => {
  assertSameOrigin(request);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
});
