import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PUBLIC_ENTRY_POINTS } from "@/lib/server/public-routes";
import { checkWrappers, type SourceText } from "./wrapper-check";

/** Invariant I3: every route handler and server action in the app is wrapper output. */

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE_DIRS = ["app", "components", "lib"];
const SOURCE_FILE = /\.tsx?$/;
const SKIPPED = /\.(test|spec)\.tsx?$|\.d\.ts$/;

const sourceFiles = (): SourceText[] =>
  SOURCE_DIRS.flatMap((dir) =>
    readdirSync(join(APP_ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((name) => SOURCE_FILE.test(name) && !SKIPPED.test(name))
      .map((name) => {
        const absolute = join(APP_ROOT, dir, name);
        return {
          path: relative(APP_ROOT, absolute).split(sep).join("/"),
          text: readFileSync(absolute, "utf8"),
        };
      }),
  );

describe("the app's routes and actions", () => {
  const files = sourceFiles();

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.path.endsWith("route.ts"))).toBe(true);
    expect(files.some((file) => file.path === "lib/auth/actions.ts")).toBe(true);
  });

  it("are all made with defineRoute or defineAction, and every public one is listed", () => {
    expect(checkWrappers(files, [...PUBLIC_ENTRY_POINTS])).toEqual([]);
  });
});
