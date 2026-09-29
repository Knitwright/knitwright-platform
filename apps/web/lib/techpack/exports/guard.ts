import { PROVENANCE_VALUES } from "@/lib/garment";
import type { TechPack } from "../types";
import { allCells } from "../walk";
import { ExportRefused } from "./errors";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A path such as `cover.styleNumber`, made readable for the log. */
const where = (path: string): string => (path === "" ? "the document" : path);

function checkSetCell(path: string, cell: Record<string, unknown>): void {
  const { value, provenance } = cell;
  if (typeof value !== "string" || value === "") throw new ExportRefused(`A set cell has no value at ${where(path)}.`);
  if (typeof provenance !== "string" || !(PROVENANCE_VALUES as readonly string[]).includes(provenance)) {
    throw new ExportRefused(`A set cell has no source at ${where(path)}.`);
  }
  for (const key of ["tenthsMm", "number"] as const) {
    if (key in cell && !Number.isFinite(cell[key])) throw new ExportRefused(`A cell holds a number that is not finite (${key}) at ${where(path)}.`);
  }
}

function checkCell(path: string, cell: Record<string, unknown>): void {
  if (cell.status === "set") return checkSetCell(path, cell);
  if (cell.status !== "to-be-confirmed") throw new ExportRefused(`A cell has an unknown status at ${where(path)}.`);
  if (Object.keys(cell).length !== 1) throw new ExportRefused(`A to-be-confirmed cell holds something at ${where(path)}.`);
}

/** Every object outside a cell that holds a `value`, which would be a value with no source. */
function valuesOutsideCells(root: unknown, path: string, insideCell: boolean, found: string[]): void {
  if (Array.isArray(root)) return root.forEach((item, index) => valuesOutsideCells(item, `${path}[${index}]`, insideCell, found));
  if (!isRecord(root)) return;
  const isCell = "status" in root;
  if (!isCell && !insideCell && ["string", "number"].includes(typeof root.value)) found.push(path);
  for (const [key, inner] of Object.entries(root)) {
    valuesOutsideCells(inner, path === "" ? key : `${path}.${key}`, insideCell || isCell, found);
  }
}

/**
 * The last check before any file is written: every set cell has a value and one of the known
 * sources, every missing cell holds nothing, and no value sits outside a cell. The types already
 * forbid a document that fails this, so a failure means a bug, and no file is made.
 */
export function assertEverySetCellHasSource(pack: TechPack): void {
  for (const { path, cell } of allCells(pack)) checkCell(path, cell);
  const stray: string[] = [];
  valuesOutsideCells(pack, "", false, stray);
  if (stray.length > 0) throw new ExportRefused(`A value has no cell, so no source, at ${where(stray[0] ?? "")}.`);
}
