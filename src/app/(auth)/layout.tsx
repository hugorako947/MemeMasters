import type { ReactNode } from "react";
import { AuthShell } from "@/components/layout/AuthShell";

/** Connexion, inscription, mot de passe : une colonne centrée. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
