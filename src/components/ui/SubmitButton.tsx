"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";

/**
 * Bouton d'envoi de formulaire : affiche la toupie (et `pendingLabel`) tant
 * que le serveur traite l'envoi, et empêche le double clic.
 */
export function SubmitButton({
  pendingLabel,
  children,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} pending={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
