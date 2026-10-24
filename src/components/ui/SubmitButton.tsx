"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";

/**
 * Bouton d'envoi de formulaire : affiche la toupie (et `pendingLabel`) tant
 * que le serveur traite l'envoi, et empêche le double clic.
 * Plusieurs boutons d'envoi dans un même formulaire (« Valider » / « Refuser ») :
 * seul celui qui a été pressé tourne ; les autres sont désactivés le temps de l'envoi.
 */
export function SubmitButton({
  pendingLabel,
  children,
  variant,
  name,
  value,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; pendingLabel?: string }) {
  const { pending, data } = useFormStatus();
  // L'envoi contient le nom et la valeur du bouton pressé (ajoutés par React à ses données).
  const pressed = pending && (!name || !data || data.get(name) === String(value ?? ""));
  return (
    <Button type="submit" variant={variant} pending={pressed} name={name} value={value} disabled={disabled || (pending && !pressed)} {...props}>
      {pressed && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
