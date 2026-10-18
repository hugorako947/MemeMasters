"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Classes des boutons (styles dans globals.css, section « Boutons autocollant »). */
export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `mm-btn mm-btn--${variant} ${extra}`.trim();
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: ReactNode;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  className = "",
  loading = false,
  loadingText,
  icon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      className={buttonClass(variant, className)}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner size="sm" tone="current" />
          <span>{loadingText ?? children}</span>
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
}

/**
 * Bouton de soumission intelligent pour formulaires :
 * détecte automatiquement l'état pending via useFormStatus()
 * et active le spinner rotatif pendant l'exécution de l'action.
 */
export function SubmitButton({
  children,
  loadingText = "Un instant…",
  variant = "primary",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      loading={pending}
      loadingText={loadingText}
      disabled={disabled || pending}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
