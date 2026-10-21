"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

/**
 * Traduit un code d'erreur d'API en phrase claire pour le joueur. Un code
 * inconnu donne une explication générale plutôt qu'un message vide.
 */
export function useErrorText(): (code: string) => string {
  const te = useTranslations("errors");
  return useCallback((code: string) => (te.has(code as "server_error") ? te(code as "server_error") : te("unknown")), [te]);
}
