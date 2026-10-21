import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/** Classes des boutons (styles dans globals.css, section « Boutons autocollant »). */
export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `mm-btn mm-btn--${variant} ${extra}`.trim();
}

/**
 * Bouton du jeu. `pending` : l'action est en cours (toupie, bouton désactivé,
 * annoncé aux lecteurs d'écran), pour que le joueur sache que son clic est pris en compte.
 */
export function Button({
  variant = "primary",
  className = "",
  pending = false,
  onClick,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pending?: boolean }) {
  // En cours, le bouton garde ses couleurs (il n'est pas « désactivé » visuellement) mais ignore les clics
  // (pointer-events: none dans globals.css). Aucune fonction n'est créée ici : ce composant est aussi
  // affiché par des composants serveur, qui ne peuvent pas transmettre de fonction au navigateur.
  return (
    <button
      className={buttonClass(variant, pending ? `gap-2 ${className}` : className)}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={pending ? undefined : onClick}
      {...props}
    >
      {pending ? <Spinner /> : null}
      <span className="mm-btn__label contents">{children}</span>
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
