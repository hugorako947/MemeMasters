"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore, useTransition } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { reloadIfStaleBuild } from "@/lib/client/stale-build";

/**
 * Une page n'a pas pu s'afficher : on explique ce qui se passe, ce que le
 * joueur peut faire, et on lui donne un code à transmettre si le problème
 * persiste. Le joueur n'est jamais laissé devant une page vide.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("errorPage");
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
    // Ancienne version du jeu restée ouverte après une mise en ligne : on recharge.
    reloadIfStaleBuild(error);
  }, [error]);

  return (
    <main id="contenu" className="safe-top mx-auto grid min-h-[70dvh] max-w-lg content-center gap-5 px-6 py-10 text-center">
      <div>
        <Logo />
      </div>
      <p className="meme-caption text-6xl" aria-hidden="true">
        {offline ? "📡" : "💥"}
      </p>
      <h1 className="font-display text-4xl leading-none sm:text-5xl">{offline ? t("offlineTitle") : t("title")}</h1>
      <p className="text-ink-soft">{offline ? t("offlineLead") : t("lead")}</p>
      <ul className="mx-auto grid max-w-sm gap-1 text-start text-sm text-ink-soft">
        <li>• {t("tip1")}</li>
        <li>• {t("tip2")}</li>
        <li>• {t("tip3")}</li>
      </ul>
      <div className="flex flex-wrap justify-center gap-3">
        <Button pending={pending} onClick={() => startTransition(() => retry())}>
          {t("retry")}
        </Button>
        <ButtonLink href="/" variant="secondary">
          {t("home")}
        </ButtonLink>
      </div>
      <p className="text-xs text-ink-soft">
        {t("contactHint")}{" "}
        <a href="/contact" className="font-bold underline">
          {t("contact")}
        </a>
        {error.digest ? (
          <>
            {" · "}
            {t("code")} <code className="rounded bg-paper px-1 font-mono">{error.digest}</code>
          </>
        ) : null}
      </p>
    </main>
  );
}
