import { describe, expect, it } from "vitest";
import { sessionPoolerUrl } from "./db";

describe("connexion à la base", () => {
  it("passe le pooler Supabase du mode transaction (6543) au mode session (5432)", () => {
    expect(sessionPoolerUrl("postgresql://u:p%40ss@aws-0-eu-west-1.pooler.supabase.com:6543/postgres")).toBe(
      "postgresql://u:p%40ss@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("ne touche ni au mode session, ni à une base locale", () => {
    expect(sessionPoolerUrl("postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres")).toBe("postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres");
    expect(sessionPoolerUrl("postgresql://postgres@localhost:6543/postgres")).toBe("postgresql://postgres@localhost:6543/postgres");
  });
});
