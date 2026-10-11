import type { ReactNode } from "react";

/** Petits éléments d'interface du tableau de bord (outil interne, en français). */
export function Box({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl border-2 border-ink bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl leading-none">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "alert" }) {
  return (
    <div className={`rounded-xl p-3 ${tone === "alert" ? "bg-[color-mix(in_srgb,var(--color-danger),transparent_88%)]" : "bg-paper"}`}>
      <p className="text-xs font-bold text-ink-soft">{label}</p>
      <p className="font-display text-3xl leading-tight">{value}</p>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b-2 border-ink px-2 py-2 text-start font-extrabold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-2 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}

export function Field({ label, name, defaultValue, type = "text", ...rest }: { label: string; name: string; defaultValue?: string | number; type?: string } & Record<string, unknown>) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className="min-h-10 rounded-xl border-2 border-ink bg-surface px-3 font-normal" {...rest} />
    </label>
  );
}

export const dateFr = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(d) : "—";
