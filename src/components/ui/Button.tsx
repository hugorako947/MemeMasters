import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-sticker)] px-5 text-base font-bold transition-[transform,box-shadow] duration-100 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-candy text-ink border-2 border-ink shadow-[var(--shadow-sticker)] active:translate-y-[3px] active:shadow-none",
  secondary:
    "bg-surface text-ink border-2 border-ink shadow-[var(--shadow-sticker)] active:translate-y-[3px] active:shadow-none",
  ghost: "text-ink underline-offset-4 hover:underline",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
