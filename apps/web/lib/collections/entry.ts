import type { PlannedSize } from "./types";
import { blocker, type Finding } from "./vocabulary";

/**
 * What the founder types on the collection screens, read into the shapes the plan holds (decision 0085).
 * No zod and no database here, so the forms can import it (tests/architecture/client-weight).
 *
 * Money is typed in pounds or dollars and kept in integer minor units: "29" is 2900 and "29.5" is 2950.
 * A figure that is not a number is never guessed at; the form says what is wrong with it.
 */

export interface ParsedSizes {
  readonly sizes: Readonly<Record<string, number>>;
  readonly findings: readonly Finding[];
}

/** "S:10, M:20" into `{ S: 10, M: 20 }`. A size with no pieces is kept, so a plan can hold a zero row. */
export function parseSizes(text: string): ParsedSizes {
  const parts = text.split(/[,\n]/).map((part) => part.trim()).filter((part) => part !== "");
  const sizes: Record<string, number> = {};
  const wrong: string[] = [];
  for (const part of parts) {
    const [label, pieces] = part.split(":").map((piece) => piece.trim());
    const qty = Number(pieces);
    if (label === undefined || label === "" || label.length > 16 || pieces === undefined || !Number.isInteger(qty) || qty < 0 || qty > 999_999) {
      wrong.push(part);
      continue;
    }
    sizes[label] = qty;
  }
  return {
    sizes,
    findings: wrong.length === 0 ? [] : [blocker("sizes_unreadable", `Write the sizes as "S:10, M:20". These could not be read: ${wrong.join(", ")}.`)],
  };
}

/** `[{S,10},{M,20}]` back into "S:10, M:20", so a form can be filled with what is saved. */
export const sizesText = (sizes: readonly PlannedSize[]): string => sizes.map((size) => `${size.label}:${size.qty}`).join(", ");

/** "29" or "29.50" into 2900 or 2950 minor units. Empty is "not set"; anything else is null. */
export function minorFrom(text: string): number | null | "unreadable" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(trimmed)) return "unreadable";
  const [whole, part = ""] = trimmed.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(part.padEnd(2, "0"));
}

/** 2950 minor units back into "29.50" for a form. Null is an empty field, never a zero. */
export const minorText = (minor: number | null): string => (minor === null ? "" : (minor / 100).toFixed(2));

/** A percentage typed as "60" into 6000 basis points. Anything outside 0 to 100 is refused. */
export function splitFrom(text: string): number | "unreadable" {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value < 0 || value > 100) return "unreadable";
  return Math.round(value * 100);
}
