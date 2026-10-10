import { useTranslations } from "next-intl";

/**
 * Pastille rouge de notification, avec le nombre de nouveautés (« 9+ » au-delà).
 * Sans nombre, simple point. Annoncée aux lecteurs d'écran.
 */
export function NotificationDot({ count, className = "" }: { count?: number; className?: string }) {
  const t = useTranslations("notifications");
  const label = count && count > 9 ? "9+" : count ? String(count) : "";
  return (
    <span className={`mm-dot ${label ? "mm-dot--count" : ""} ${className}`} aria-hidden={false}>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{count ? t("count", { count }) : t("new")}</span>
    </span>
  );
}
