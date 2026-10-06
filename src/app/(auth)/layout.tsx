import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="safe-top mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-6">
      <header>
        <Logo />
      </header>
      <main id="contenu" className="flex flex-1 flex-col justify-center py-8">
        {children}
      </main>
    </div>
  );
}
