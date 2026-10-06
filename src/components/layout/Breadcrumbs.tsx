"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { buildBreadcrumbs } from "@/lib/navigation/breadcrumbs";

/** Fil d'Ariane : « Accueil › Réglages ». Masqué sur la page d'accueil. */
export function Breadcrumbs({ className = "" }: { className?: string }) {
  const t = useTranslations("breadcrumb");
  const crumbs = buildBreadcrumbs(usePathname());
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label={t("label")} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold">
        {crumbs.map((crumb, i) => {
          const label = crumb.key ? t(crumb.key as "home") : crumb.text;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden="true" className="text-ink-soft">
                  ›
                </span>
              ) : null}
              {crumb.linked ? (
                <Link
                  href={crumb.href}
                  className="rounded-md px-1 text-link underline-offset-4 transition-colors hover:bg-surface hover:underline"
                >
                  {label}
                </Link>
              ) : (
                <span aria-current={crumb.current ? "page" : undefined} className={crumb.current ? "px-1 text-ink" : "px-1 text-ink-soft"}>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
