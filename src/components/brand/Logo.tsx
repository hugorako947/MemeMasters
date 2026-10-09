"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type MouseEvent } from "react";
import { GAME_CONFIG } from "@/config/game.config";

/** Éclats lancés au clic (couleur, direction, rotation). */
const BURST = [
  { c: "#ffd23f", dx: "-46px", dy: "-30px", rot: "-40deg" },
  { c: "#ff3d7f", dx: "48px", dy: "-28px", rot: "30deg" },
  { c: "#5fd0ff", dx: "-30px", dy: "26px", rot: "60deg" },
  { c: "#b36bff", dx: "34px", dy: "28px", rot: "-25deg" },
  { c: "#ffffff", dx: "0px", dy: "-44px", rot: "15deg" },
];

/**
 * Logo : se dandine au survol, brille de temps en temps, et au clic fait
 * « boing » en lançant des confettis avant de ramener à l'accueil.
 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const router = useRouter();
  const [boing, setBoing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cls = size === "lg" ? "text-4xl" : "text-2xl";

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // Nouvel onglet, clic molette… : comportement normal du lien.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    event.preventDefault();
    setBoing(false);
    requestAnimationFrame(() => setBoing(true));
    if (timer.current) clearTimeout(timer.current);
    // Laisse le temps de voir l'animation avant de changer de page.
    timer.current = setTimeout(() => {
      router.push("/");
      setTimeout(() => setBoing(false), 400);
    }, 280);
  }

  return (
    <Link
      href="/"
      onClick={onClick}
      data-boing={boing ? "true" : "false"}
      className={`mm-logo meme-caption ${cls} -rotate-1 py-1.5`}
      aria-label={`${GAME_CONFIG.GAME_NAME}, accueil`}
    >
      <span className="mm-logo__text">{GAME_CONFIG.GAME_NAME}</span>
      {BURST.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="mm-logo__burst"
          style={{ ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--rot" as string]: b.rot, background: b.c }}
        />
      ))}
    </Link>
  );
}
