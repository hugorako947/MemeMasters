"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { NAV_STACK_KEY, previousFromStack, resolveBackTarget } from "@/lib/navigation/back";

const subscribe = () => () => {};

function readPrevious(pathname: string): string | null {
  try {
    const stack = JSON.parse(sessionStorage.getItem(NAV_STACK_KEY) ?? "[]") as string[];
    return Array.isArray(stack) ? previousFromStack(stack, pathname) : null;
  } catch {
    return null;
  }
}

/** Lien discret « ← Retour à la page précédente ». */
export function BackLink() {
  const t = useTranslations("back");
  const pathname = usePathname();
  const previous = useSyncExternalStore(
    subscribe,
    () => readPrevious(pathname),
    () => null,
  );
  const target = resolveBackTarget(pathname, previous);
  return (
    <Link
      href={target.href}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
    >
      <span aria-hidden="true">←</span>
      {t(target.labelKey as "home")}
    </Link>
  );
}
