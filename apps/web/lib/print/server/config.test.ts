import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

/**
 * The print files outline names and numbers from the bundled font, which is read from disk, and the host copies only the files a
 * route is traced to use. So the print route must list the font folder, like the export route does (decision 0008).
 */
const APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ROUTES = ["/api/projects/[projectId]/print-files", "/api/projects/[projectId]/print-files/summary"];
const picomatch = createRequire(import.meta.url)("next/dist/compiled/picomatch") as (glob: string, options: object) => (route: string) => boolean;
const includes = (route: string): string[] =>
  Object.entries(nextConfig.outputFileTracingIncludes ?? {}).flatMap(([glob, files]) => (picomatch(glob, { dot: true, contains: true })(route) ? files : []));

describe("the print routes ship the font", () => {
  it.each(ROUTES)("traces %s to the font folder", (route) => {
    expect(includes(route)).toContain("./assets/fonts/**");
  });
  it("is about real route files", () => {
    expect(existsSync(join(APP_ROOT, "app", "api", "projects", "[projectId]", "print-files", "route.ts"))).toBe(true);
    expect(existsSync(join(APP_ROOT, "app", "api", "projects", "[projectId]", "print-files", "summary", "route.ts"))).toBe(true);
  });
  it("gives the zip route the same sandbox policy as an export, after the rule for every path", async () => {
    const rules = ((await nextConfig.headers?.()) ?? []).flatMap((rule, index) => {
      const policy = rule.headers.find((h) => h.key.toLowerCase() === "content-security-policy");
      return policy ? [{ index, source: rule.source, value: policy.value }] : [];
    });
    const everyPath = rules.findIndex((r) => r.source === "/:path*");
    const zip = rules.findIndex((r) => r.source === "/api/projects/:projectId/print-files");
    expect(zip).toBeGreaterThan(everyPath);
    expect(rules[zip].value).toContain("sandbox");
  });
});
