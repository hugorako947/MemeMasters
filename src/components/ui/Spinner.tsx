/** Toupie d'attente aux couleurs du jeu (petites actions : bouton, liste qui se charge…). */
export function Spinner({ size, label, className = "" }: { size?: string; label?: string; className?: string }) {
  return (
    <span
      className={`mm-spinner ${className}`}
      style={size ? { ["--size" as string]: size } : undefined}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
