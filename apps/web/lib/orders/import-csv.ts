import { parseCsv } from "@/lib/sizing/csv";
import { rosterRowSchema, type RosterRow } from "@/lib/production/contract";
import { cleanName } from "./text";

export const ROSTER_ROWS_MAX = 1000;

const ROSTER_FIELDS = ["name", "number", "sizeLabel", "cut", "quantity"] as const;
export type RosterField = (typeof ROSTER_FIELDS)[number];
/** The column (0-based) that holds each field. A field with no column is left out. */
export type ColumnMapping = Readonly<Partial<Record<RosterField, number>>>;
type Cut = RosterRow["cut"];

const HEADER_WORDS: Readonly<Record<RosterField, readonly string[]>> = {
  name: ["name", "player", "player name", "surname", "last name", "lastname", "shirt name"],
  number: ["number", "no", "no.", "#", "num", "jersey", "jersey number", "shirt number", "player number"],
  sizeLabel: ["size", "shirt size", "sizelabel", "size label"],
  cut: ["cut", "fit", "gender", "wearer", "sex"],
  quantity: ["qty", "quantity", "count", "shirts", "pieces"],
};

const CUT_WORDS: Readonly<Record<string, Cut>> = {
  mens: "mens", men: "mens", male: "mens", m: "mens", "men's": "mens",
  womens: "womens", women: "womens", female: "womens", ladies: "womens", w: "womens", f: "womens", "women's": "womens",
  junior: "junior", juniors: "junior", youth: "junior", kids: "junior", boys: "junior", girls: "junior",
  unisex: "unisex",
};

export function detectMapping(headers: readonly string[]): ColumnMapping {
  const found: Partial<Record<RosterField, number>> = {};
  headers.forEach((header, index) => {
    const key = header.trim().toLowerCase();
    const field = ROSTER_FIELDS.find((f) => found[f] === undefined && HEADER_WORDS[f].includes(key));
    if (field) found[field] = index;
  });
  return found;
}

interface ImportOptions {
  readonly mapping?: ColumnMapping;
  /** False when the first line is already a player. */
  readonly header?: boolean;
  /** The sizes the design is made in, so "xl" is read as "XL". */
  readonly run?: readonly string[];
  /** Used when the file has no cut column. The wearer is never guessed from a name. */
  readonly defaultCut?: Cut;
}

export interface ImportProblem {
  readonly line: number;
  readonly message: string;
}

export type ImportResult =
  | { readonly ok: true; readonly rows: readonly RosterRow[]; readonly problems: readonly ImportProblem[]; readonly mapping: ColumnMapping; readonly headers: readonly string[] }
  | { readonly ok: false; readonly needsMapping: boolean; readonly message: string; readonly headers: readonly string[]; readonly mapping: ColumnMapping };

const fail = (message: string, needsMapping = false, headers: readonly string[] = [], mapping: ColumnMapping = {}): ImportResult => ({ ok: false, needsMapping, message, headers, mapping });

function readRow(cells: readonly string[], mapping: ColumnMapping, options: ImportOptions): RosterRow | string {
  const cell = (field: RosterField): string => (mapping[field] === undefined ? "" : (cells[mapping[field]] ?? "").trim());
  const name = cleanName(cell("name"));
  if (!name.ok) return name.message;
  const rawCut = cell("cut").toLowerCase();
  const cut = rawCut === "" ? (options.defaultCut ?? "unisex") : CUT_WORDS[rawCut];
  if (!cut) return `The cut "${cell("cut")}" is not one of men's, women's, junior or unisex.`;
  const size = cell("sizeLabel");
  const sizeLabel = options.run?.find((s) => s.toLowerCase() === size.toLowerCase()) ?? size;
  const quantityText = cell("quantity");
  const quantity = quantityText === "" ? 1 : /^\d{1,3}$/.test(quantityText) ? Number(quantityText) : Number.NaN;
  const parsed = rosterRowSchema.safeParse({ name: name.name, number: cell("number").replace(/^#/, ""), sizeLabel, cut, quantity });
  if (parsed.success) return parsed.data;
  const bad = parsed.error.issues[0]?.path[0];
  if (bad === "number") return "The number must be digits, 0 to 999.";
  if (bad === "quantity") return "The quantity must be a whole number from 1 to 999.";
  if (bad === "sizeLabel") return "The size is empty or too long.";
  return "This row could not be read.";
}

/** Reads a team list from CSV text. Good rows are kept. Each bad row is reported with its line and why. */
export function parseRosterCsv(text: string, options: ImportOptions = {}): ImportResult {
  const parsed = parseCsv(text);
  if (!parsed.ok) return fail(parsed.message);
  const hasHeader = options.header !== false;
  const headers = hasHeader ? (parsed.records[0]?.cells ?? []) : [];
  const body = hasHeader ? parsed.records.slice(1) : parsed.records;
  if (body.length === 0) return fail("The file has no players in it.");
  if (body.length > ROSTER_ROWS_MAX) return fail(`A team list holds up to ${ROSTER_ROWS_MAX} rows. Split the file.`);
  const mapping = options.mapping ?? detectMapping(headers);
  const width = Math.max(headers.length, ...body.map((r) => r.cells.length));
  const outside = Object.values(mapping).some((column) => column >= width);
  if (outside) return fail("A chosen column is not in the file.", true, headers, mapping);
  if (mapping.number === undefined || mapping.sizeLabel === undefined) {
    return fail("Choose which column holds the number and which holds the size.", true, headers, mapping);
  }
  const rows: RosterRow[] = [];
  const problems: ImportProblem[] = [];
  for (const record of body) {
    const row = readRow(record.cells, mapping, options);
    if (typeof row === "string") problems.push({ line: record.line, message: `Line ${record.line}: ${row}` });
    else rows.push(row);
  }
  return { ok: true, rows, problems, mapping, headers };
}
