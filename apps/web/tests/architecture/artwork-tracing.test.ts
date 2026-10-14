import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Artwork intake draws an uploaded PDF with pdfjs-dist and its native canvas package (decision 0036). Both are
 * found by name at run time. pdfjs-dist must therefore be loaded from node_modules, not bundled, and the host
 * must ship the canvas binaries and the reader's own fonts with the upload route.
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("the artwork upload route can read a PDF once deployed", () => {
  it("leaves pdfjs-dist out of the bundle", () => {
    expect(nextConfig.serverExternalPackages).toContain("pdfjs-dist");
  });

  it("ships the canvas binaries and the PDF reader's fonts with the upload route", () => {
    const files = nextConfig.outputFileTracingIncludes?.["/api/artwork"] ?? [];
    expect(files.some((glob) => glob.includes("@napi-rs+canvas"))).toBe(true);
    expect(files).toContain("./node_modules/pdfjs-dist/standard_fonts/**");
  });

  it("names a route and a font folder that exist", () => {
    expect(existsSync(join(APP_ROOT, "app", "api", "artwork", "route.ts"))).toBe(true);
    expect(existsSync(join(APP_ROOT, "node_modules", "pdfjs-dist", "standard_fonts"))).toBe(true);
  });
});
