import type { ReactNode } from "react";

/** Panneau « autocollant » : contour d'encre et ombre décalée. */
export function Panel({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return (
    <Tag className={`rounded-[var(--radius-sticker)] border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker)] ${className}`}>
      {children}
    </Tag>
  );
}
