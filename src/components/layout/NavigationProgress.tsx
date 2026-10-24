"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markBusy } from "@/lib/client/busy";

type State = "idle" | "start" | "loading" | "done";

/**
 * Barre de chargement en haut de l'écran : elle part au moment même du clic
 * sur un lien (ou de l'envoi d'un formulaire qui change de page), file vers la
 * fin, puis se termine dès que la nouvelle page s'affiche. Le joueur voit
 * tout de suite que son clic est pris en compte.
 * Dans la même page (seuls les paramètres ?… changent, ex. sections du tableau de
 * bord), le lien ou le bouton cliqué affiche aussi un cercle tournant jusqu'à l'arrivée ;
 * pour une autre page, c'est l'écran de chargement des cartes (loading.tsx).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = `${pathname}?${search.toString()}`;
  const last = useRef(url);
  const releaseBusy = useRef<() => void>(() => undefined);

  useEffect(() => {
    const busy = (el: HTMLElement | null | undefined) => {
      releaseBusy.current();
      releaseBusy.current = markBusy(el);
    };
    const begin = () => {
      if (timer.current) clearTimeout(timer.current);
      setState("start");
      requestAnimationFrame(() => requestAnimationFrame(() => setState("loading")));
      // Filet de sécurité : la barre ne reste jamais bloquée.
      timer.current = setTimeout(() => {
        setState("done");
        releaseBusy.current();
      }, 15_000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = new URL(a.href, location.href);
      if (href.origin !== location.origin) return;
      // Même page (ancre, onglet ?vue=… géré sur place) : rien à charger.
      if (href.pathname === location.pathname && href.search === location.search) return;
      begin();
      if (href.pathname === location.pathname) busy(a);
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // Formulaires de recherche (GET) : ils changent de page.
      if (!e.defaultPrevented && form.method.toLowerCase() === "get" && !form.target) {
        begin();
        busy(e.submitter instanceof HTMLElement ? e.submitter : null);
      }
    };
    const onStart = () => begin();
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("mm:navigation-start", onStart);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("mm:navigation-start", onStart);
    };
  }, []);

  // Nouvelle adresse affichée : la barre se termine.
  useEffect(() => {
    if (last.current === url) return;
    last.current = url;
    if (timer.current) clearTimeout(timer.current);
    releaseBusy.current();
    releaseBusy.current = () => undefined;
    setState((s) => (s === "idle" ? s : "done"));
    timer.current = setTimeout(() => setState("idle"), 500);
  }, [url]);

  if (state === "idle") return null;
  return (
    <div className="mm-progress" data-state={state} aria-hidden="true">
      <div className="mm-progress__bar" />
    </div>
  );
}

/** Démarre la barre pour une navigation lancée par le code (router.push…). */
export function startNavigationProgress() {
  window.dispatchEvent(new Event("mm:navigation-start"));
}
