import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/lib/server/public-pages";
import { PUBLIC_ENTRY_POINTS } from "@/lib/server/public-routes";
import { checkWrappers, type SourceText } from "./wrapper-check";

/** Invariant I3: every route handler and server action in the app is wrapper output. */

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Folders that hold no app code. Everything else under the app root is read. */
const NOT_APP_CODE = new Set([
  "node_modules",
  ".next",
  "coverage",
  "test-results",
  "playwright-report",
  "e2e",
  "tests",
  "public",
]);

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const SKIPPED = /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return NOT_APP_CODE.has(entry.name) ? [] : walk(join(dir, entry.name));
    }
    return SOURCE_FILE.test(entry.name) && !SKIPPED.test(entry.name)
      ? [join(dir, entry.name)]
      : [];
  });

const sourceFiles = (): SourceText[] =>
  walk(APP_ROOT).map((absolute) => ({
    path: relative(APP_ROOT, absolute).split(sep).join("/"),
    text: readFileSync(absolute, "utf8"),
  }));

describe("the app's routes and actions", () => {
  const files = sourceFiles();

  it("finds the source files, wherever they are", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.path.endsWith("route.ts"))).toBe(true);
    expect(files.some((file) => file.path === "lib/auth/actions.ts")).toBe(true);
    expect(files.some((file) => file.path === "proxy.ts")).toBe(true);
    expect(files.every((file) => !file.path.includes("node_modules"))).toBe(true);
  });

  // The check reads every source file's text; it grows with the repository and timed out at the 5 second default on a busy runner.
  it("are all made with defineRoute or defineAction, and every public one is listed", () => {
    expect(checkWrappers(files, [...PUBLIC_ENTRY_POINTS], [...PUBLIC_PAGES])).toEqual([]);
  }, 30_000);

  it("has no pages folder, whose API routes the wrappers do not cover", () => {
    expect(existsSync(join(APP_ROOT, "pages"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "src", "pages"))).toBe(false);
  });
});
