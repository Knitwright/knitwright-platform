import type { RosterRow } from "@/lib/production/contract";
import { csvLine } from "./text";

type Cut = RosterRow["cut"];
const CUT_ORDER: readonly Cut[] = ["mens", "womens", "junior", "unisex"];
export const CUT_LABELS: Readonly<Record<Cut, string>> = { mens: "Men's", womens: "Women's", junior: "Junior", unisex: "Unisex" };

export interface Manifest {
  readonly orderName: string;
  readonly sizes: readonly string[];
  readonly cuts: readonly Cut[];
  /** Shirts for each size (row) and cut (column). */
  readonly cells: readonly (readonly number[])[];
  readonly sizeTotals: readonly number[];
  readonly cutTotals: readonly number[];
  readonly totalShirts: number;
  /** One line per roster row, by number. */
  readonly players: readonly RosterRow[];
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Sizes in the order the design makes them, then any others by name. */
function sizesOf(rows: readonly RosterRow[], run: readonly string[]): string[] {
  const used = new Set(rows.map((r) => r.sizeLabel));
  const others = [...used].filter((s) => !run.includes(s)).sort();
  return [...run.filter((s) => used.has(s)), ...others];
}

export function buildManifest(orderName: string, rows: readonly RosterRow[], run: readonly string[]): Manifest {
  const sizes = sizesOf(rows, run);
  const cuts = CUT_ORDER.filter((cut) => rows.some((r) => r.cut === cut));
  const cells = sizes.map((size) => cuts.map((cut) => sum(rows.filter((r) => r.sizeLabel === size && r.cut === cut).map((r) => r.quantity))));
  const players = [...rows].sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, "en"));
  return {
    orderName,
    sizes,
    cuts,
    cells,
    sizeTotals: cells.map(sum),
    cutTotals: cuts.map((_, c) => sum(cells.map((line) => line[c] ?? 0))),
    totalShirts: sum(rows.map((r) => r.quantity)),
    players,
  };
}

const ROSTER_HEAD = ["Name", "Number", "Size", "Cut", "Quantity"] as const;
const playerCells = (r: RosterRow): string[] => [r.name, r.number, r.sizeLabel, r.cut, String(r.quantity)];

/** The team list as a CSV that the import reads back. */
export const rosterCsv = (rows: readonly RosterRow[]): string => [csvLine(ROSTER_HEAD), ...rows.map((r) => csvLine(playerCells(r)))].join("");

/** Totals by size and cut, then the player list. Every name is made safe for a spreadsheet. */
export function manifestCsv(manifest: Manifest): string {
  const totals = manifest.sizes.map((size, i) => csvLine([size, ...(manifest.cells[i] ?? []).map(String), String(manifest.sizeTotals[i] ?? 0)]));
  return [
    csvLine(["Shirts by size and cut"]),
    csvLine(["Size", ...manifest.cuts.map((c) => CUT_LABELS[c]), "Total"]),
    ...totals,
    csvLine(["Total", ...manifest.cutTotals.map(String), String(manifest.totalShirts)]),
    csvLine([]),
    csvLine(["Players"]),
    csvLine(ROSTER_HEAD),
    ...manifest.players.map((r) => csvLine(playerCells(r))),
  ].join("");
}
