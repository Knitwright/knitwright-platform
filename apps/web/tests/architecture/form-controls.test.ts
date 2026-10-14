import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAGE_WIDTH, pageFrame } from "@/components/shell/page-width";

/**
 * Native form controls on the dark theme (the owner, 2026-10-14: "the country dropdown is white on
 * white"), and the page widths that stop a page sitting in a phone-sized strip on a large screen.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CSS = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

const token = (name: string): string => {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(CSS)?.[1];
  if (!value) throw new Error(`No --${name} hex colour in globals.css`);
  return value;
};

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((at) => channel(Number.parseInt(hex.slice(at, at + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The WCAG contrast ratio of two opaque colours. */
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** The body of the first rule whose selector list contains `selector`. */
const ruleFor = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\:-]/g, "\\$&");
  return new RegExp(`(?:^|[,\\s])${escaped}[^{]*\\{([^}]*)\\}`, "m").exec(CSS)?.[1] ?? "";
};

describe("contrast helper", () => {
  it("gives 21 for black on white and 1 for a colour on itself", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#2b46f0", "#2b46f0")).toBeCloseTo(1, 5);
  });
});

describe("native form controls on the dark theme", () => {
  it("asks the browser for its dark controls", () => {
    expect(/:root\s*\{[^}]*color-scheme:\s*dark/.test(CSS)).toBe(true);
  });

  it("gives every choice of a list an opaque dark background with ink text", () => {
    for (const selector of ["option", "optgroup"]) {
      const rule = ruleFor(selector);
      expect(rule, selector).toContain("background-color: var(--surface-solid)");
      expect(rule, selector).toContain("color: var(--ink)");
    }
  });

  it("keeps the text of a choice readable at WCAG AA or better", () => {
    expect(contrast(token("ink"), token("surface-solid"))).toBeGreaterThanOrEqual(4.5);
    // A choice that cannot be picked, and a placeholder, use the faint colour.
    expect(contrast(token("faint"), token("surface-solid"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("faint"), token("canvas"))).toBeGreaterThanOrEqual(4.5);
  });

  it("covers the pale autofill background and keeps the ink text", () => {
    const rule = ruleFor("input:-webkit-autofill");
    expect(rule).toContain("-webkit-text-fill-color: var(--ink)");
    expect(rule).toMatch(/box-shadow: 0 0 0 1000px var\(--surface-solid\) inset/);
  });

  it("puts a legend inside its fieldset instead of across the border", () => {
    const rule = ruleFor("legend");
    expect(rule).toContain("float: left");
    expect(rule).toContain("width: 100%");
    expect(ruleFor("legend + *")).toContain("clear: both");
    // Clearing swallows the next element's top margin, so a plain fieldset's legend keeps the gap.
    expect(ruleFor("fieldset:not(.flex, .grid, .inline-flex, .inline-grid) > legend")).toContain("margin-bottom");
  });
});

function pages(): string[] {
  return ["app", "components/auth", "components/shell"].flatMap((folder) =>
    readdirSync(join(ROOT, folder), { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile() && /\.tsx$/.test(entry.name))
      .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replaceAll("\\", "/")),
  );
}

describe("page widths", () => {
  it("never makes a form narrower than the sign-up card, and pages use the studio width", () => {
    expect(PAGE_WIDTH).toEqual({ form: "max-w-xl", reading: "max-w-3xl", content: "max-w-6xl" });
    expect(pageFrame("content")).toBe("mx-auto w-full max-w-6xl px-5");
  });

  it("has no page that sets its own narrow outer width", () => {
    // A page's outer frame comes from page-width.ts. Small widths inside a page are fine.
    for (const path of pages()) {
      const text = readFileSync(join(ROOT, path), "utf8");
      expect(/<main[^>]*\bmax-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl)\b/.test(text), path).toBe(false);
    }
  });
});
