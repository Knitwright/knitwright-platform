import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The tokens in app/globals.css are docs/spec/10-design-system.md's values (decision 0137), and
 * the v2.2 names the old screens still use stay readable on the light theme.
 */

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

const value = (name: string): string => {
  const found = new RegExp(`--${name}:\\s*([^;]+);`, "i").exec(CSS)?.[1];
  if (!found) throw new Error(`No --${name} in globals.css`);
  return found.trim().toLowerCase();
};

const channel = (part: number): number => {
  const c = part / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((at) => channel(Number.parseInt(hex.slice(at, at + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

const SPEC: Readonly<Record<string, string>> = {
  navy: "#0b1f4b",
  "navy-2": "#142c63",
  "navy-3": "#06132f",
  electric: "#2f6bff",
  "electric-soft": "#eaf0ff",
  gold: "#f2b705",
  "gold-soft": "#fff4cc",
  bg: "#ffffff",
  soft: "#f3f4f6",
  "soft-2": "#eceef2",
  border: "#e5e7eb",
  dot: "#d5d9e0",
  text: "#111318",
  "text-2": "#374151",
  // §2 says #6B7280; darkened for AA on the grey fills (decision 0137).
  muted: "#5f6672",
  "muted-2": "#9ca3af",
  ok: "#067647",
  "ok-soft": "#e7f8ef",
  warn: "#b54708",
  "warn-soft": "#fef0c7",
  bad: "#d92d20",
  "bad-soft": "#fee4e2",
  info: "#2f6bff",
  "info-soft": "#eaf0ff",
  "mark-measure": "#d92d20",
  "mark-callout": "#2f6bff",
};

describe("the v3.9 tokens", () => {
  it("carry every colour of §2 at its exact value", () => {
    for (const [name, hex] of Object.entries(SPEC)) expect(value(`color-${name}`), name).toBe(hex);
  });

  it("carry the type scale of §3, the radii of §5 and its four elevations", () => {
    expect(value("text-display")).toBe("48px");
    expect(value("text-h1")).toBe("30px");
    expect(value("text-body")).toBe("14px");
    expect(value("text-micro")).toBe("11px");
    expect(value("radius-md")).toBe("10px");
    expect(value("radius-3xl")).toBe("22px");
    expect(value("shadow-e4")).toBe("0 24px 60px rgba(16, 24, 40, 0.3)");
    expect(value("motion-base")).toBe("180ms");
  });

  it("use Inter with straight-legged digits, on a light theme only", () => {
    expect(value("font-sans")).toMatch(/^var\(--font-inter\)/);
    expect(CSS).toContain('font-feature-settings: "cv11", "ss01"');
    expect(CSS).toMatch(/color-scheme:\s*light/);
    expect(CSS).not.toMatch(/color-scheme:\s*dark/);
    expect(CSS).not.toMatch(/prefers-color-scheme/);
  });

  it("give blue text a shade that passes AA, since electric itself is a hair under", () => {
    expect(contrast(value("color-electric"), "#ffffff")).toBeLessThan(4.5);
    expect(contrast(value("color-link"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value("color-link"), value("color-electric-soft"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keep every status text readable on its own fill and on white", () => {
    for (const tone of ["ok", "warn"]) {
      expect(contrast(value(`color-${tone}`), value(`color-${tone}-soft`)), tone).toBeGreaterThanOrEqual(4.5);
    }
    for (const tone of ["ok", "warn", "bad", "muted", "text-2"]) {
      expect(contrast(value(`color-${tone}`), "#ffffff"), tone).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the v2.2 names on the light theme", () => {
  const TEXT = ["ink", "ink-2", "muted", "faint", "chalk", "chalk-muted", "cobalt-soft", "ok", "warn"];
  const SURFACES = ["canvas", "surface", "surface-solid", "tile"];

  it("map every old name onto a light value in the one marked block", () => {
    expect(CSS).toContain("LEGACY COMPATIBILITY");
    for (const name of SURFACES) expect(luminance(value(name)), name).toBeGreaterThan(0.85);
  });

  it("keep every old text colour at AA or better on every old surface", () => {
    for (const text of TEXT) {
      // `text-ok` and `text-warn` were always the Tailwind colours, now the §2 status colours.
      const hex = text === "ok" || text === "warn" ? value(`color-${text}`) : value(text);
      for (const surface of SURFACES) expect(contrast(hex, value(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keep white text readable on the old dark fills", () => {
    expect(contrast("#ffffff", value("cobalt"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", value("ink"))).toBeGreaterThanOrEqual(4.5);
  });

  it("make the old 'white' ink on light surfaces and white again inside dark fills", () => {
    expect(/:root\s*\{[^}]*--color-white:\s*#111318/.test(CSS)).toBe(true);
    expect(/\.bg-cobalt,[^{]*\{\s*--color-white:\s*#ffffff/.test(CSS)).toBe(true);
  });
});
