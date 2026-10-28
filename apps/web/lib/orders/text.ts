/**
 * Player names are typed by people, so they are untrusted. A name is cleaned and limited to
 * what can be printed on a shirt. Anything that goes into a file is escaped again for that file,
 * because a stored name is only as safe as the last place it is written to.
 */

export const NAME_MAX_LENGTH = 40;
export const NAME_PROBLEM =
  "Use letters, digits, spaces and the marks ' - . & only, up to 40 characters. Names are printed as typed.";

/** Control, format (such as right-to-left override), unassigned and private-use characters. */
const HIDDEN = /\p{C}/gu;
const ALLOWED = /^[\p{L}\p{M}\p{N} '’.&-]*$/u;

type CleanName = { readonly ok: true; readonly name: string } | { readonly ok: false; readonly message: string };

export function cleanName(raw: string): CleanName {
  const name = raw.normalize("NFC").replace(HIDDEN, "").replace(/\s+/g, " ").trim();
  if (name.length > NAME_MAX_LENGTH || !ALLOWED.test(name)) return { ok: false, message: NAME_PROBLEM };
  return { ok: true, name };
}

/** A spreadsheet runs a cell that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell. A cell a spreadsheet could run as a formula gets a leading apostrophe, then the
 * cell is quoted when it holds a comma, a quote or a line break.
 */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const csvLine = (cells: readonly string[]): string => `${cells.map(csvCell).join(",")}\r\n`;

/** For any text that reaches an SVG drawing. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
