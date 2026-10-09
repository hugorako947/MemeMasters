import { useTranslations } from "next-intl";

/** Point rouge de notification (annoncé « Nouveau » aux lecteurs d'écran). */
export function NotificationDot({ className = "" }: { className?: string }) {
  const t = useTranslations("notifications");
  return (
    <span className={`mm-dot ${className}`}>
      <span className="sr-only">{t("new")}</span>
    </span>
  );
}
