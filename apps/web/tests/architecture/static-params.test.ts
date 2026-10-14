import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A page built ahead with `dynamicParams = false` answers 404 for every one of its built
 * addresses once a server action calls revalidatePath("/", "layout"), as renaming a brand and
 * changing a display name do: Next.js drops the built page and then refuses to make it again.
 * Client navigation to it shows "Page not found" too, because the router's prefetch keeps the
 * 404. So no page uses it. A page that must refuse unknown addresses calls notFound() instead.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const pages = (): string[] =>
  readdirSync(join(ROOT, "app"), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /^(page|layout)\.tsx?$/.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));

describe("pages built ahead of time", () => {
  it("finds the pages to check", () => {
    expect(pages()).toContain("app/legal/[document]/page.tsx");
  });

  it("never turn off dynamic params, which makes them 404 after a site-wide revalidation", () => {
    const offending = pages().filter((path) =>
      /export\s+const\s+dynamicParams\s*=\s*false/.test(readFileSync(join(ROOT, path), "utf8")),
    );
    expect(offending).toEqual([]);
  });
});
