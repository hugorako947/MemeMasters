"use client";

import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { Field } from "./Field";

/**
 * Champ mot de passe avec un œil pour afficher ou masquer la saisie.
 * Le bouton est un vrai bouton (clavier, lecteur d'écran) qui ne soumet pas le formulaire.
 */
export function PasswordField(props: Omit<ComponentProps<typeof Field>, "type">) {
  const t = useTranslations("password");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={visible ? "text" : "password"} className="pe-14" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hide") : t("show")}
        aria-pressed={visible}
        aria-controls={props.id ?? `f-${props.name}`}
        className="absolute end-1.5 top-[1.85rem] grid size-10 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-paper hover:text-ink"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  );
}
