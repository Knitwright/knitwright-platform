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
    const entries = [...walk("app/api/ops"), ...walk("lib/ops")].filter((f) => /route\.ts$|actions\.ts$/.test(f));
    // Part 1's actions and its two download routes; part 2's four action files and the packing list route (decision 0050).
    expect(entries.length).toBeGreaterThanOrEqual(8);
    for (const path of entries) {
      const text = read(path);
      const wrapped = [...text.matchAll(/define(?:Route|Action)\(/g)].length;
      const checked = [...text.matchAll(/assertPlatformAdmin\(|await ops\(/g)].length;
      expect(wrapped, path).toBeGreaterThan(0);
      expect(checked, path).toBeGreaterThanOrEqual(wrapped);
    }
  });

  it("guards each platform-only entry point outside ops too: pattern service, designers, settings and the pattern-file route (L15)", () => {
    // Every action or route in these places is either listed as a member's own, or must ask for a platform admin in its own body.
    const MEMBER_OWN = new Set(["requestPatternAction", "enrolAction", "newSubmissionAction", "sendSubmissionAction", "reportMarkAction"]);
    const GUARD = /assertPlatformAdmin\(|opsContext\(|reviewer\(/;
    const files = [
      ...walk("lib/pattern-service"), ...walk("lib/designers"), ...walk("lib/settings"), ...walk("lib/moderation"),
      "app/(ops)/ops/pattern-requests/[requestId]/files/route.ts", "app/(ops)/ops/review/marks/route.ts",
    ].filter((f) => /route\.ts$|actions\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(4);
    let guarded = 0;
    for (const path of files) {
      const blocks = read(path).split(/\n(?=export const )/).filter((block) => /^export const \w+ = define(Action|Route)\(/.test(block));
      expect(blocks.length, path).toBeGreaterThan(0);
      for (const block of blocks) {
        const name = /^export const (\w+)/.exec(block)![1]!;
        if (MEMBER_OWN.has(name)) continue;
        expect(block, `${path} ${name}`).toMatch(GUARD);
        guarded += 1;
      }
    }
    // The ops pattern-file route also checks before it reads the body (M7), not after.
    const upload = read("app/(ops)/ops/pattern-requests/[requestId]/files/route.ts");
    expect(upload).toMatch(/authorize:[^\n]*assertPlatformAdmin\(/);
    expect(guarded).toBeGreaterThanOrEqual(6);
  });

  it("is linked from nowhere in the public shell, the studio or the home page", () => {
    const places = ["app/page.tsx", "app/layout.tsx", "components/shell", "components/home", "components/studio", "components/brand", "lib/navigation", "app/(app)", "app/(auth)", "app/legal"];
    const files = places.flatMap((p) => (/\.tsx?$/.test(p) ? [p] : walk(p)));
    expect(files.length).toBeGreaterThan(10);
    for (const path of files) expect(read(path), path).not.toMatch(/["'`]\/ops(\/|["'`?#])|\/api\/ops/);
  });

  it("ships the PDF font with every ops PDF and print download route", () => {
    const config = read("next.config.ts");
    expect(config).toContain('"/api/ops/batches/\\\\[batchId\\\\]/factory-sheet": ["./assets/fonts/**"]');
    expect(config).toContain('"/api/ops/batches/\\\\[batchId\\\\]/print-files": ["./assets/fonts/**"]');
    expect(config).toContain('"/api/ops/orders/\\\\[orderId\\\\]/packing-list": ["./assets/fonts/**"]');
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
