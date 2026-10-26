import type { ReactNode } from "react";

/** Panneau « autocollant » : contour d'encre et ombre décalée. */
export function Panel({ children, className = "", as: Tag = "section", id }: { children: ReactNode; className?: string; as?: "section" | "div" | "article"; id?: string }) {
  return (
    <Tag id={id} className={`rounded-[var(--radius-sticker)] border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker)] ${className}`}>
      {children}
    </Tag>
  );
}
