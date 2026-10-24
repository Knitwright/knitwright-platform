import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkPage } from "./page-guard-check";
import { parse } from "./source";

/**
 * Decision 0043: the ops console is for platform admins only. No page of it renders without
 * requirePlatformAdmin as its first statement, no ops route or action runs without asking the database
 * whether the caller is a platform admin, and nothing public or in the studio links to it.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SKIPPED = /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;

const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !SKIPPED.test(entry.name) ? [path.split(sep).join("/")] : [];
  });

const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("the ops console is for platform admins only", () => {
  const opsFiles = walk("app/(ops)");

  it("has pages to check", () => {
    expect(opsFiles.filter((f) => /\/(page|layout)\.tsx$/.test(f)).length).toBeGreaterThanOrEqual(5);
  });

  it("guards every page and layout with requirePlatformAdmin first, and refuses any other check", () => {
    for (const path of opsFiles) {
      expect(checkPage(path, parse({ path, text: read(path) }), new Set()).violations, path).toEqual([]);
    }
    const asMember = 'import { requireMember } from "@/lib/server/page-guards";\nexport default async function P() { await requireMember(); return null; }';
    const path = "app/(ops)/ops/page.tsx";
    expect(checkPage(path, parse({ path, text: asMember }), new Set()).violations.map((v) => v.rule)).toEqual(["page-not-guarded"]);
    expect(checkPage(path, parse({ path, text: asMember }), new Set([path])).violations.map((v) => v.rule)).toEqual(["page-not-guarded"]);
  });

  it("asks the database whether the caller is a platform admin in every ops route and action", () => {
    const entries = [...walk("app/api/ops"), "lib/ops/actions.ts"].filter((f) => /route\.ts$|actions\.ts$/.test(f));
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const path of entries) {
      const text = read(path);
      const wrapped = [...text.matchAll(/define(?:Route|Action)\(/g)].length;
      const checked = [...text.matchAll(/assertPlatformAdmin\(|await ops\(/g)].length;
      expect(wrapped, path).toBeGreaterThan(0);
      expect(checked, path).toBeGreaterThanOrEqual(wrapped);
    }
  });

  it("is linked from nowhere in the public shell, the studio or the home page", () => {
    const places = ["app/page.tsx", "app/layout.tsx", "components/shell", "components/home", "components/studio", "components/brand", "lib/navigation", "app/(app)", "app/(auth)", "app/legal"];
    const files = places.flatMap((p) => (/\.tsx?$/.test(p) ? [p] : walk(p)));
    expect(files.length).toBeGreaterThan(10);
    for (const path of files) expect(read(path), path).not.toMatch(/["'`]\/ops(\/|["'`?#])|\/api\/ops/);
  });

  it("ships the PDF font with both download routes", () => {
    const config = read("next.config.ts");
    expect(config).toContain('"/api/ops/batches/\\\\[batchId\\\\]/factory-sheet": ["./assets/fonts/**"]');
    expect(config).toContain('"/api/ops/batches/\\\\[batchId\\\\]/print-files": ["./assets/fonts/**"]');
  });

  it("never reaches the public routes list or the public pages list", () => {
    expect(read("lib/server/public-routes.ts")).not.toMatch(/ops/);
    expect(read("lib/server/public-pages.ts")).not.toMatch(/\(ops\)|\/ops/);
  });

  it("keeps its tables out of the browser's hands: no ops code uses the browser client", () => {
    const code = [...walk("app/(ops)"), ...walk("lib/ops"), ...walk("components/ops")].map((p) => ({ p, t: read(p) }));
    for (const { p, t } of code) expect(t, p).not.toMatch(/supabase\/(browser|client)|createBrowserClient/);
  });
});
