import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requirePlayer } from "@/lib/server/auth";

/** Toutes les pages de ce groupe exigent un joueur avec un profil créé. */
export default async function GameLayout({ children }: { children: ReactNode }) {
  const { player } = await requirePlayer();
  return <AppShell player={player}>{children}</AppShell>;
}
