import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefineAction } from "@/lib/server/core/create-define-action";
import { createDefineRoute } from "@/lib/server/core/create-define-route";
import type { Auth } from "@/lib/server/core/guard";
import { makeDeps } from "@/lib/server/core/test-deps";
import { LIMITS } from "@/lib/server/limits";
import { checkRateLimits, wrapperCalls } from "./rate-limit-check";
import type { SourceText } from "./source";

/**
 * Plan step 26, task 2: every API route and server action is rate limited. The wrapper check
 * (repo.test.ts) proves every one is wrapper output. This file proves each names a real rule, and
 * that the wrappers refuse a request over its limit before the handler runs, whatever the auth.
 * Whether the limits hold under load needs a deployment: see docs/launch/evidence.md.
 */

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "test-results", "playwright-report", "e2e", "tests", "public"]);
const SOURCE = /\.[cm]?[jt]sx?$/;
const NOT_SOURCE = /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : walk(join(dir, entry.name));
    return SOURCE.test(entry.name) && !NOT_SOURCE.test(entry.name) ? [join(dir, entry.name)] : [];
  });

const appFiles = (): SourceText[] =>
  walk(APP_ROOT).map((absolute) => ({
    path: relative(APP_ROOT, absolute).split(sep).join("/"),
    text: readFileSync(absolute, "utf8"),
  }));

const file = (text: string): SourceText => ({ path: "app/api/x/route.ts", text });

const HEADER = `
import { defineRoute } from "@/lib/server/define-route";
import { LIMITS } from "@/lib/server/limits";
`;

describe("checkRateLimits", () => {
  it("accepts a wrapper that names a rule", () => {
    const text = `${HEADER} export const GET = defineRoute({ auth: "user", rateLimit: LIMITS.read, schema: {}, handler });`;
    expect(checkRateLimits([file(text)], ["read"])).toEqual([]);
  });

  it("rejects a rule written inline, which nobody reviewed with the others", () => {
    const text = `${HEADER} export const GET = defineRoute({ auth: "user", rateLimit: { name: "x", limit: 1e9, windowSeconds: 1 }, schema: {}, handler });`;
    expect(checkRateLimits([file(text)], ["read"])).toHaveLength(1);
  });

  it("rejects a rule that does not exist, a spread config and a missing config", () => {
    const unknown = `${HEADER} export const GET = defineRoute({ auth: "user", rateLimit: LIMITS.nope, schema: {}, handler });`;
    const spread = `${HEADER} export const GET = defineRoute({ ...base, rateLimit: LIMITS.read });`;
    const empty = `${HEADER} export const GET = defineRoute();`;
    expect(checkRateLimits([file(unknown), file(spread), file(empty)], ["read"])).toHaveLength(3);
  });

  it("rejects LIMITS taken from anywhere else", () => {
    const text = `
      import { defineRoute } from "@/lib/server/define-route";
      import { LIMITS } from "./my-limits";
      export const GET = defineRoute({ auth: "user", rateLimit: LIMITS.read, schema: {}, handler });`;
    expect(checkRateLimits([file(text)], ["read"])).toHaveLength(1);
  });
});

// Reading and parsing every file of the app takes several seconds on a loaded runner with coverage on.
const SCAN_MS = 30_000;

describe("the app's routes and actions", () => {
  const files = appFiles();
  const calls = wrapperCalls(files);

  it("are found, in every API route file and every actions file", () => {
    const withCalls = new Set(calls.map((call) => call.file));
    const entryFiles = files
      .map((source) => source.path)
      .filter((path) => /(^|\/)route\.ts$/.test(path) || /(^|\/)actions\.ts$/.test(path));
    expect(entryFiles.length).toBeGreaterThan(4);
    expect(entryFiles.filter((path) => !withCalls.has(path))).toEqual([]);
  });

  it("each name a rate limit from lib/server/limits.ts", () => {
    expect(checkRateLimits(files, Object.keys(LIMITS))).toEqual([]);
  }, SCAN_MS);

  // The paid and costly routes added after step 9 each keep their own rule, so a copy-paste of
  // a cheaper one is caught. Integration of steps 12, 13, 14, 25 and 26.
  it.each([
    ["app/api/projects/[projectId]/intent/route.ts", "assistant"],
    ["app/api/projects/[projectId]/read-image/route.ts", "readImage"],
    ["app/api/projects/[projectId]/images/route.ts", "startImages"],
    ["app/api/projects/[projectId]/images/[jobId]/route.ts", "pollJob"],
    ["app/api/projects/[projectId]/exports/[format]/route.ts", "export"],
    ["app/api/charts/files/route.ts", "importChart"],
  ])("%s is limited by LIMITS.%s", (path, rule) => {
    expect(calls.filter((call) => call.file === path).map((call) => call.rule)).toEqual([rule]);
  });

  it("limits the assistant's proposals, the guided start and deletion by their own rules", () => {
    const rules = new Set(calls.filter((call) => call.file.endsWith("actions.ts")).map((call) => call.rule));
    for (const rule of ["applyProposal", "createProject", "deleteDesign", "deleteAccount"]) expect(rules.has(rule), rule).toBe(true);
  });
});

describe("LIMITS", () => {
  it("are whole, positive numbers, each under its own name", () => {
    const rules = Object.values(LIMITS);
    for (const rule of rules) {
      expect(Number.isInteger(rule.limit) && rule.limit > 0).toBe(true);
      expect(Number.isInteger(rule.windowSeconds) && rule.windowSeconds > 0).toBe(true);
    }
    expect(new Set(rules.map((rule) => rule.name)).size).toBe(rules.length);
  });
});

describe("the wrappers", () => {
  const AUTHS: readonly Auth[] = ["member", "user", "public"];

  it.each(AUTHS)("refuse a %s route over its limit before the handler runs", async (auth) => {
    const { deps, recorded } = makeDeps({ allow: () => false });
    let ran = false;
    const route = createDefineRoute(deps)({
      auth,
      rateLimit: LIMITS.read,
      schema: {},
      handler: async () => {
        ran = true;
        return {};
      },
    });

    const response = await route(new Request("http://localhost/api/x"), { params: Promise.resolve({}) });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(String(LIMITS.read.windowSeconds));
    expect(ran).toBe(false);
    expect(recorded.hits[0].rule).toBe(LIMITS.read);
  });

  it.each(AUTHS)("refuse a %s action over its limit before the handler runs", async (auth) => {
    const { deps } = makeDeps({ allow: () => false });
    let ran = false;
    const action = createDefineAction(deps)({
      auth,
      rateLimit: LIMITS.signIn,
      schema: z.object({}),
      handler: async () => {
        ran = true;
      },
    });

    expect(await action({})).toMatchObject({ success: false, error: { code: "rate_limited" } });
    expect(ran).toBe(false);
  });
});
