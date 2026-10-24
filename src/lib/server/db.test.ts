import { describe, expect, it } from "vitest";
import { transactionPoolerUrl } from "./db";

describe("connexion à la base", () => {
  it("passe le pooler Supabase du mode session (5432) au mode transaction (6543)", () => {
    expect(transactionPoolerUrl("postgresql://u:p%40ss@aws-0-eu-west-1.pooler.supabase.com:5432/postgres")).toBe(
      "postgresql://u:p%40ss@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    );
  });

  it("ne touche ni au mode transaction, ni à une base locale", () => {
    expect(transactionPoolerUrl("postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres")).toBe(
      "postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    );
    expect(transactionPoolerUrl("postgresql://postgres@localhost:5432/postgres")).toBe("postgresql://postgres@localhost:5432/postgres");
  });
});
