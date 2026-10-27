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

/** Couronne de cible (8 segments orange/rouge) du logo, calculée une fois. */
const TARGET = Array.from({ length: 8 }, (_, i) => {
  const cx = 22;
  const cy = 22;
  const r1 = 21;
  const r0 = 15.5;
  const p = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  };
  const a0 = i * 45;
  const a1 = (i + 1) * 45;
  return { d: `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`, c: i % 2 ? "#c23b2c" : "#e0702e" };
});

/** Personnage du jeu (visage râleur en cible, avec son arme) : marque compacte à côté du nom, fond transparent. */
function LogoMark() {
  return (
    <svg viewBox="0 0 52 44" className="mm-logo__mark" width="1.5em" height="1.27em" aria-hidden="true" focusable="false">
      {/* Arme à droite */}
      <rect x="34" y="18.5" width="15" height="7" rx="1.6" fill="#2b2340" stroke="#120c24" strokeWidth="1.3" />
      <rect x="45.5" y="20" width="5.5" height="4" rx="0.8" fill="#4a4270" />
      {/* Bulle-cible */}
      <circle cx="22" cy="22" r="22" fill="#241a4a" />
      {TARGET.map((s, i) => (
        <path key={i} d={s.d} fill={s.c} />
      ))}
      <circle cx="22" cy="22" r="15.5" fill="#241a4a" />
      <circle cx="22" cy="22" r="14" fill="#aadcf7" stroke="#1a1238" strokeWidth="1.4" />
      {/* Sourcils froncés */}
      <path d="M9.5 16 L18 20.4" stroke="#1a1238" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M34.5 16 L26 20.4" stroke="#1a1238" strokeWidth="2.6" strokeLinecap="round" />
      {/* Yeux */}
      <ellipse cx="16.6" cy="23" rx="3.6" ry="4.6" fill="#fff" stroke="#1a1238" strokeWidth="1.1" />
      <circle cx="17.6" cy="23.8" r="1.9" fill="#1a1238" />
      <ellipse cx="27.4" cy="23" rx="3.6" ry="4.6" fill="#fff" stroke="#1a1238" strokeWidth="1.1" />
      <circle cx="26.4" cy="23.8" r="1.9" fill="#1a1238" />
      {/* Bouche + langue */}
      <path d="M15 30 q7 7.5 14 0.5 q-1.6 6.4 -7.8 6.4 q-5.9 0 -6.2 -6.9z" fill="#1a1238" />
      <path d="M21 35 q3 -0.3 4 2.2 q-3.8 2.2 -5.4 0z" fill="#ff6a8e" />
    </svg>
  );
}

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
      <LogoMark />
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
