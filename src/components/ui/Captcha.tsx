"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { publicEnv } from "@/lib/env.public";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Vérification anti-robot (Cloudflare Turnstile). Le plus souvent, il n'y a
 * rien à faire : la case se coche toute seule. Le jeton est envoyé avec le
 * formulaire (champ caché « captchaToken ») ou transmis par onToken.
 * Sans clé de site configurée (développement), rien n'est affiché.
 * resetKey : changer sa valeur redemande un jeton (un jeton ne sert qu'une fois).
 */
export function Captcha({ onToken, resetKey }: { onToken?: (token: string | null) => void; resetKey?: unknown }) {
  const siteKey = publicEnv.turnstileSiteKey;
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: locale,
          theme: "auto",
          size: "flexible",
          callback: (t: string) => {
            setToken(t);
            callback.current?.(t);
          },
          "expired-callback": () => {
            setToken("");
            callback.current?.(null);
          },
          "error-callback": () => {
            setToken("");
            callback.current?.(null);
          },
        });
      })
      .catch(() => callback.current?.(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, locale]);

  // Nouveau jeton après chaque envoi du formulaire.
  useEffect(() => {
    if (resetKey === undefined || !widget.current || !window.turnstile) return;
    window.turnstile.reset(widget.current);
    const clear = setTimeout(() => {
      setToken("");
      callback.current?.(null);
    }, 0);
    return () => clearTimeout(clear);
  }, [resetKey]);

  if (!siteKey) return null;
  return (
    <div className="grid gap-1">
      <div ref={box} className="min-h-[65px]" />
      <input type="hidden" name="captchaToken" value={token} />
    </div>
  );
}
