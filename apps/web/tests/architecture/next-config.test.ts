import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { describe, expect, it } from "vitest";
import { PDF_FONT_FILE } from "@/lib/flat/pdf-font";
import { SVG_POLICY } from "@/lib/techpack/exports/headers";
import nextConfig from "../../next.config";

/**
 * Decision 0008: the PDF font is read from disk when a PDF is made, and the host copies only the
 * files that a route is traced to use. So the export route must list the font folder under
 * `outputFileTracingIncludes`, or a deployed export fails with a missing file. The route is matched
 * the way Next.js matches it: picomatch, with the options that Next.js passes.
 */

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ROUTE_FILE = join(APP_ROOT, "app", "api", "projects", "[projectId]", "exports", "[format]", "route.ts");
const ROUTE = "/api/projects/[projectId]/exports/[format]";
const FONTS = "./assets/fonts/**";

type Matcher = (route: string) => boolean;
const picomatch = createRequire(import.meta.url)("next/dist/compiled/picomatch") as (glob: string, options: object) => Matcher;

/** The files a config adds to the trace of a route, found the way Next.js finds them. */
const includesFor = (config: NextConfig, route: string): string[] =>
  Object.entries(config.outputFileTracingIncludes ?? {}).flatMap(([glob, files]) =>
    picomatch(glob, { dot: true, contains: true })(route) ? files : [],
  );

describe("the export route ships the PDF font (T10)", () => {
  it("is where this test says it is, so the test is about the real route", () => {
    expect(existsSync(ROUTE_FILE)).toBe(true);
  });

  it("is traced to the font folder in next.config.ts", () => {
    expect(includesFor(nextConfig, ROUTE)).toContain(FONTS);
  });

  it("would fail if the entry were removed", () => {
    const without = { ...nextConfig, outputFileTracingIncludes: {} };
    expect(includesFor(without, ROUTE)).not.toContain(FONTS);
    expect(includesFor({}, ROUTE)).not.toContain(FONTS);
  });

  it("would fail if the entry named another route", () => {
    const other = { ...nextConfig, outputFileTracingIncludes: { "/api/other": [FONTS] } };
    expect(includesFor(other, ROUTE)).not.toContain(FONTS);
  });

  it("names a folder that holds the font the PDF reads", () => {
    expect(existsSync(join(APP_ROOT, "assets", "fonts", "Geist-Regular.ttf"))).toBe(true);
    expect(PDF_FONT_FILE.replaceAll("\\", "/")).toContain("/assets/fonts/");
    expect(existsSync(PDF_FONT_FILE)).toBe(true);
  });
});

/**
 * Headers set in next.config.ts win over the headers a route handler sets, and when two rules match
 * one path the later rule wins. So the sandbox policy an SVG export needs must be in next.config.ts,
 * in a rule for the export route placed after the rule for every path.
 */
describe("the export route keeps its sandbox policy (T9)", () => {
  const EXPORT_SOURCE = "/api/projects/:projectId/exports/:format";

  const policyRules = async (config: NextConfig) =>
    ((await config.headers?.()) ?? []).flatMap((rule, index) => {
      const policy = rule.headers.find((header) => header.key.toLowerCase() === "content-security-policy");
      return policy ? [{ index, source: rule.source, policy: policy.value }] : [];
    });

  it("sets the policy for the export route after the policy for every path, so it wins", async () => {
    const rules = await policyRules(nextConfig);
    const everyPath = rules.findIndex((rule) => rule.source === "/:path*");
    const exportRoute = rules.findIndex((rule) => rule.source === EXPORT_SOURCE);
    expect(everyPath).toBeGreaterThanOrEqual(0);
    expect(exportRoute).toBeGreaterThan(everyPath);
  });

  it("holds every part of the SVG policy, and still refuses to be framed", async () => {
    const policy = (await policyRules(nextConfig)).find((rule) => rule.source === EXPORT_SOURCE)?.policy ?? "";
    for (const part of SVG_POLICY.split(";").map((entry) => entry.trim())) expect(policy).toContain(part);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });
});

/**
 * Decision 0026: a share page is open to anyone holding its link. Its address must never be sent
 * on to another site, it must never be indexed, and it must never be kept by a cache. The rule for
 * share pages comes after the rule for every path, so its Referrer-Policy wins.
 */
describe("share pages keep their address to themselves", () => {
  const SHARE_SOURCE = "/s/:token";

  const rules = async () => (await nextConfig.headers?.()) ?? [];
  const valueOf = (headers: readonly { key: string; value: string }[], key: string) =>
    headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;

  it("sends no referrer, asks not to be indexed and not to be stored", async () => {
    const share = (await rules()).find((rule) => rule.source === SHARE_SOURCE);
    expect(share).toBeDefined();
    expect(valueOf(share?.headers ?? [], "Referrer-Policy")).toBe("no-referrer");
    expect(valueOf(share?.headers ?? [], "X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(valueOf(share?.headers ?? [], "Cache-Control")).toBe("private, no-store, max-age=0");
  });

  it("comes after the rule for every path, so its referrer rule wins", async () => {
    const all = await rules();
    expect(all.findIndex((rule) => rule.source === SHARE_SOURCE)).toBeGreaterThan(all.findIndex((rule) => rule.source === "/:path*"));
  });
});

/**
 * Going back to a studio page seen in the last half minute is instant: the browser keeps it.
 * Every server action that changes data revalidates or sets a cookie, which empties that store, so a save is
 * never hidden. It is kept short so another member's change shows soon.
 */
describe("the browser keeps pages it has just shown", () => {
  it("keeps a dynamic page for 30 seconds", () => {
    expect(nextConfig.experimental?.staleTimes?.dynamic).toBe(30);
  });
});
