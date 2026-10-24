import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";

/** Toutes les clés d'un fichier de traduction, à plat (« dup.level.1 »…). */
function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const load = (code: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", `${code}.json`), "utf8")) as Record<string, unknown>;

describe("traductions", () => {
  const reference = new Set(keys(load("fr")));

  it.each(LOCALES.map((l) => l.code).filter((c) => c !== "fr"))("« %s » a exactement les mêmes clés que le français", (code) => {
    const other = new Set(keys(load(code)));
    const missing = [...reference].filter((k) => !other.has(k));
    const extra = [...other].filter((k) => !reference.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("n'a aucun texte vide", () => {
    for (const { code } of LOCALES) {
      const flat = keys(load(code));
      const data = load(code);
      const empty = flat.filter((k) => k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], data) === "");
      expect(empty, code).toEqual([]);
    }
  });
});
