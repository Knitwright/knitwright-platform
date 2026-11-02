import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Plan v5, "Rules every workstream follows": files under 400 lines and functions under 50.
 *
 * Nothing enforced either number. The v4 code review counted them by hand, the v5 review counted
 * them again, and both times the file rule held while the function rule did not — so this test
 * holds the one that is true, rather than freezing a count of the one that is not. Review v5
 * records the four `lib` functions over 50 lines as findings for their own workstreams; when they
 * are split, a second rule belongs here beside this one.
 *
 * The limit is on source a person writes. Tests are not source: a table-driven test is long on
 * purpose, and shortening one would make it worse.
 */

const WEB = fileURLToPath(new URL("../../", import.meta.url));
const MAX_LINES = 400;
const ROOTS = ["lib", "app", "components"];

const sources = (dir: string): string[] =>
  readdirSync(join(WEB, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const lineCount = (path: string): number => readFileSync(path, "utf8").split("\n").length;

describe("the length of a source file", () => {
  const files = ROOTS.flatMap(sources);

  it("is measured over the whole of lib, app and components", () => {
    expect(files.length).toBeGreaterThan(500);
    for (const root of ROOTS) expect(files.some((path) => path.slice(WEB.length).startsWith(`${root}/`)), root).toBe(true);
  });

  it(`is at most ${MAX_LINES} lines, as the plan's rules say`, () => {
    const over = files
      .map((path) => ({ path: path.slice(WEB.length), lines: lineCount(path) }))
      .filter((file) => file.lines > MAX_LINES)
      .sort((a, b) => b.lines - a.lines)
      .map((file) => `${file.path} (${file.lines} lines)`);
    expect(over).toEqual([]);
  });

  it("would name a file that went over", () => {
    const longest = Math.max(...files.map(lineCount));
    // A floor on the check itself: if every file were tiny, the rule above would pass vacuously.
    expect(longest).toBeGreaterThan(100);
    expect(longest).toBeLessThanOrEqual(MAX_LINES);
  });
});
