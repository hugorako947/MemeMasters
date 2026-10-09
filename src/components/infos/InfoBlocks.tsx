import type { ReactNode } from "react";

/** Bloc d'explication commun aux pages d'Infos. */
export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-[1.5rem] border-2 border-ink bg-surface p-5 shadow-[0_3px_0_0_var(--mm-shadow)] sm:p-6">
      <h3 className="font-display text-2xl leading-none">{title}</h3>
      {children}
    </section>
  );
}

export function InfoList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-1.5 text-ink-soft">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true" className="text-candy-ink">
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function InfoTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className={`border-b-2 border-ink px-2 py-2 font-extrabold ${i === 0 ? "text-start" : "text-end"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`border-b border-line px-2 py-2 ${i === 0 ? "text-start font-semibold" : "text-end font-display text-base"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
