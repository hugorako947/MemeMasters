"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const ARROWS: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/**
 * Nom affiché d'une touche ou d'un bouton de la souris. Les touches sont enregistrées par leur position
 * physique (« KeyW ») : quand le navigateur le permet, on affiche le caractère réel du clavier du joueur
 * (« Z » sur un clavier AZERTY).
 */
export function useBindingLabel(): (binding: string) => string {
  const t = useTranslations("match.controls");
  const [layout, setLayout] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
    keyboard
      ?.getLayoutMap?.()
      .then((map) => setLayout(new Map(map)))
      .catch(() => {});
  }, []);
  return (binding) => {
    if (binding.startsWith("Unbound")) return "—";
    if (binding === "Mouse0") return t("mouseLeft");
    if (binding === "Mouse1") return t("mouseMiddle");
    if (binding === "Mouse2") return t("mouseRight");
    if (binding.startsWith("Mouse")) return t("mouseButton", { n: Number(binding.slice(5)) + 1 });
    if (binding === "Space") return t("space");
    if (ARROWS[binding]) return ARROWS[binding];
    const char = layout?.get(binding);
    if (char && char.trim()) return char.toUpperCase();
    if (binding.startsWith("Key")) return binding.slice(3);
    if (binding.startsWith("Digit")) return binding.slice(5);
    if (binding.startsWith("Numpad")) return `Num ${binding.slice(6)}`;
    return binding.replace(/(Left|Right)$/, "");
  };
}
