"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Mode hors ligne : bandeau d'information et attribut data-offline sur <html>.
 * Les éléments marqués « mm-online-only » (ouvrir un booster, amis, messages,
 * boutique…) sont alors grisés ; les pages déjà visitées restent consultables.
 */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

  useEffect(() => {
    if (online) delete document.documentElement.dataset.offline;
    else document.documentElement.dataset.offline = "true";
  }, [online]);

  if (online) return null;
  return (
    <div role="status" className="safe-top fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-2">
      <p className="max-w-2xl rounded-2xl border-2 border-ink bg-[#1a1238] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-[0_3px_0_0_rgb(0_0_0/0.3)]">
        <span className="font-extrabold">{t("title")}</span> · {t("text")}
      </p>
    </div>
  );
}
