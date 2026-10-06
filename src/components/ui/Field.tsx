import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string | null;
}

/** Champ de formulaire accessible : libellé, aide et erreur reliés à l'input. */
export function Field({ label, name, hint, error, id, ...input }: FieldProps) {
  const inputId = id ?? `f-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="min-h-12 rounded-xl border-2 border-ink bg-surface px-4 text-base outline-none placeholder:text-ink-soft/70 focus-visible:border-link aria-[invalid=true]:border-danger"
        {...input}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-danger text-danger",
    success: "border-success text-success",
    info: "border-ink text-ink",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border-2 bg-surface px-4 py-3 text-sm font-semibold ${styles}`}>
      {children}
    </p>
  );
}
