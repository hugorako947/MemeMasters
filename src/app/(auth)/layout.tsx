import type { ReactNode } from "react";
import { RarityShowcase } from "@/components/card/RarityShowcase";
import { PublicShell } from "@/components/layout/PublicShell";

/** Connexion, inscription… : formulaire à gauche, les 8 raretés à côté. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_22rem] lg:justify-between">
        <div className="w-full max-w-md">{children}</div>
        <RarityShowcase className="lg:self-start" />
      </div>
    </PublicShell>
  );
}
