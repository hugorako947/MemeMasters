// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleBuildError, reloadIfStaleBuild } from "./stale-build";

describe("ancienne version du jeu après une mise en ligne", () => {
  const reload = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockReset();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("reconnaît un fichier JavaScript introuvable (Turbopack, webpack, import dynamique)", () => {
    expect(isStaleBuildError({ name: "ChunkLoadError", message: "Failed to load chunk /_next/static/chunks/a.js" })).toBe(true);
    expect(isStaleBuildError({ name: "Error", message: "Loading chunk 123 failed." })).toBe(true);
    expect(isStaleBuildError({ name: "TypeError", message: "Failed to fetch dynamically imported module: /x.js" })).toBe(true);
    expect(isStaleBuildError({ name: "Error", message: "Cannot read properties of undefined" })).toBe(false);
  });

  it("recharge une seule fois par minute, jamais pour une autre erreur", () => {
    const chunk = { name: "ChunkLoadError", message: "Failed to load chunk" };
    expect(reloadIfStaleBuild({ name: "Error", message: "boom" }, 1_000_000)).toBe(false);
    expect(reloadIfStaleBuild(chunk, 1_000_000)).toBe(true);
    expect(reloadIfStaleBuild(chunk, 1_030_000)).toBe(false);
    expect(reloadIfStaleBuild(chunk, 1_061_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
