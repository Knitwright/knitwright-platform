import { createHash } from "node:crypto";
import { toLab } from "@/lib/print/rules/colour";

/** Small encoders the package files share: CSV, stable JSON, hashes and colour. */

const FORMULA = /^[=+\-@\t\r]/;

/** One CSV cell. Text a spreadsheet could read as a formula is made plain text; quotes when needed. */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  const safe = typeof value === "string" && FORMULA.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A CSV file with CRLF line ends and a final line end. */
export const csv = (rows: readonly (readonly (string | number | boolean | null)[])[]): string => rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
};

/** JSON with keys in sorted order, two-space indent and a final line end, so it is byte-stable. */
export const stableJson = (value: unknown): string => `${JSON.stringify(sortKeys(value), null, 2)}\n`;

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

export const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const round1 = (n: number): number => {
  const r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r;
};

/**
 * CIELAB (D65 white, 2 degree observer) of an sRGB hex colour, to one decimal. The maths is the
 * print rules' own `toLab`, so a colour cannot read one way in a guardrail and another in the
 * package. It is the screen colour's Lab, computed, not measured: the strike-off is the truth
 * (R-SUB-005), which `colour_spec.pdf` says in words.
 */
export const hexToLab = (hex: string): [number, number, number] => toLab(hex).map(round1) as [number, number, number];
