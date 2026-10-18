import type { HTMLAttributes } from "react";

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
  tone?: "primary" | "candy" | "sticker" | "white" | "current";
}

const SIZES = {
  xs: "size-3.5 border-2",
  sm: "size-4.5 border-2",
  md: "size-7 border-3",
  lg: "size-12 border-4",
  xl: "size-16 border-4",
};

const TONES = {
  primary: "border-ink/20 border-t-ink",
  candy: "border-candy/25 border-t-candy",
  sticker: "border-sticker/30 border-t-sticker",
  white: "border-white/30 border-t-white",
  current: "border-current/25 border-t-current",
};

/**
 * Cercle rotatif animé façon MemeMasters :
 * bordure épaisse de sticker et rotation dynamique.
 */
export function Spinner({
  size = "md",
  tone = "current",
  label = "Chargement en cours...",
  className = "",
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-block shrink-0 animate-spin rounded-full ${SIZES[size]} ${TONES[tone]} ${className}`}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
