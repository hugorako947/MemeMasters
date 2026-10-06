import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string | null;
}

/** Astérisque des champs obligatoires (décoratif : `required` porte l'information). */
function RequiredMark({ required }: { required?: boolean }) {
  if (!required) return null;
  return (
    <span aria-hidden="true" className="ml-0.5 text-candy-ink">
      *
    </span>
  );
}

/** Champ de formulaire accessible : libellé, aide et erreur reliés à l'input. */
export function Field({ label, name, hint, error, id, required, ...input }: FieldProps) {
  const inputId = id ?? `f-${name}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold">
        {label}
        <RequiredMark required={required} />
      </label>
      <input
        id={inputId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="min-h-12 rounded-xl border-2 border-ink bg-surface px-4 text-base outline-none transition-shadow placeholder:text-ink-soft/70 focus-visible:border-link focus-visible:shadow-[0_0_0_4px_rgb(45_91_255_/_0.18)] aria-[invalid=true]:border-danger"
        {...input}
      />
      {hint ? (
        <div id={hintId} className="text-sm text-ink-soft">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Case à cocher obligatoire, avec un libellé riche (liens possibles). */
export function CheckboxField({
  name,
  checked,
  onChange,
  children,
  required,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  required?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        required={required}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-6 shrink-0 cursor-pointer rounded-md border-2 border-ink accent-candy"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        {children}
        <RequiredMark required={required} />
      </label>
    </div>
  );
}

export function RequiredNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-ink-soft">
      <span aria-hidden="true" className="text-candy-ink">
        *{" "}
      </span>
      {children}
    </p>
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
