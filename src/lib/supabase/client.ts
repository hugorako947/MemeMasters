"use client";
import { createBrowserClient } from "@supabase/ssr";
import { assertSupabasePublicEnv } from "@/lib/env.public";

/** Client Supabase du navigateur (lecture filtrée par RLS, Auth, Realtime). */
export function createSupabaseBrowserClient() {
  const { url, key } = assertSupabasePublicEnv();
  return createBrowserClient(url, key);
}
