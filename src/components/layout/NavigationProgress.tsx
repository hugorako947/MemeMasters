"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markBusy, takePressed } from "@/lib/client/busy";

type State = "idle" | "start" | "loading" | "done";

/**
 * Barre de chargement en haut de l'écran : elle part au moment même du clic
 * sur un lien (ou de l'envoi d'un formulaire qui change de page), file vers la
 * fin, puis se termine dès que la nouvelle page s'affiche. Le joueur voit
 * tout de suite que son clic est pris en compte.
 * Le lien ou le bouton cliqué (navigation du bas, sections du tableau de bord, profil
 * d'un joueur…) affiche aussi un cercle tournant à sa place si la page tarde, jusqu'à ce
 * que la nouvelle adresse s'affiche ; pour une autre page, l'écran de chargement des
 * cartes (loading.tsx) prend ensuite le relais dans le cadre du jeu.
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
      busy(a);
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // Formulaires de recherche (GET) : ils changent de page.
      if (!e.defaultPrevented && form.method.toLowerCase() === "get" && !form.target) {
        begin();
        busy(e.submitter instanceof HTMLElement ? e.submitter : null);
      }
    };
    // Navigation lancée par le code (router.push…) : le bouton pressé juste avant tourne.
    const onStart = () => {
      begin();
      busy(takePressed());
    };
    // Clics écoutés à la capture : un lien de Next.js annule l'événement (preventDefault) pour
    // naviguer lui-même, avant qu'il n'atteigne un écouteur ordinaire du document. Seul le logo
    // intercepte aussi le clic, et il navigue quand même (après son animation).
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("mm:navigation-start", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
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
