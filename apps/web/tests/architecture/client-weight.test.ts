import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Heavy libraries stay out of the browser where a page does not need them. A client component
 * that imports a constant from a module holding a zod schema ships all of zod (about 350 KB
 * before compression) to the browser, so the fields, limits and labels a form shows live in
 * modules without zod. A server action module ("use server") is only a reference in the
 * browser, so the trace stops there.
 *
 * The design editor, the tech pack, the guided flow and the size chart import need the garment
 * rules (and so zod) in the browser; they are listed in SECOND_PASS until their own pass.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HEAVY = /from "(zod|three|read-excel-file|write-excel-file|@react-pdf\/renderer|pdfjs-dist)(\/[^"]*)?"/;

const SECOND_PASS = [
  "components/studio/",
  "components/techpack/",
  "components/home/",
  "components/guided/",
  "components/garment3d/",
  "components/charts/",
];

const sourceFiles = (folder: string): string[] =>
  readdirSync(join(ROOT, folder), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const resolveImport = (spec: string, from: string): string | null => {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  const found = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((ext) => base + ext).find((path) => existsSync(path) && statSync(path).isFile());
  return found ?? null;
};

const isServerActions = (text: string): boolean => /^\s*["']use server["']/.test(text);

/** The import chain from `file` to a heavy library, or null when there is none. */
const heavyChain = (file: string, seen: Set<string> = new Set()): string[] | null => {
  if (seen.has(file)) return null;
  seen.add(file);
  const text = readFileSync(file, "utf8");
  if (isServerActions(text)) return null;
  const heavy = HEAVY.exec(text);
  if (heavy) return [heavy[1]];
  for (const match of text.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)) {
    const next = resolveImport(match[1], file);
    const chain = next ? heavyChain(next, seen) : null;
    if (chain) return [relative(ROOT, next!).replaceAll("\\", "/"), ...chain];
  }
  return null;
};

describe("client weight", () => {
  it("keeps zod and other heavy libraries out of client components that do not need them", () => {
    const offenders = sourceFiles("components")
      .map((file) => relative(ROOT, file).replaceAll("\\", "/"))
      .filter((path) => !SECOND_PASS.some((prefix) => path.startsWith(prefix)))
      .filter((path) => /^["']use client["']/m.test(readFileSync(join(ROOT, path), "utf8")))
      .map((path) => ({ path, chain: heavyChain(join(ROOT, path)) }))
      .filter(({ chain }) => chain !== null)
      .map(({ path, chain }) => `${path} -> ${chain!.join(" -> ")}`);
    expect(offenders).toEqual([]);
  });
});
