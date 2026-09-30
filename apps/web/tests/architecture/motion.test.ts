import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Plan step 15, task 5: a person who asks their system for less motion gets none. The global
 * rule turns every animation and transition down to nothing, and no component moves anything
 * in a way that rule cannot reach: no smooth scrolling from script, no animation class without
 * `motion-safe:` in front of it.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function components(): string[] {
  return ["app", "components"].flatMap((folder) =>
    readdirSync(join(ROOT, folder), { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.tsx$/.test(entry.name))
      .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/")),
  );
}

describe("reduced motion", () => {
  it("turns animations and transitions off when the system asks for less motion", () => {
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
    const rule = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("animation-duration: 0.01ms !important");
    expect(rule).toContain("transition-duration: 0.01ms !important");
    expect(rule).toContain("scroll-behavior: auto !important");
  });

  it("has no component that scrolls smoothly from script or animates without motion-safe", () => {
    for (const path of components()) {
      const text = readFileSync(join(ROOT, path), "utf8");
      expect(/behavior:\s*["']smooth["']/.test(text), path).toBe(false);
      expect(/(?<!motion-safe:)\banimate-(?!none)/.test(text), path).toBe(false);
    }
  });
});
