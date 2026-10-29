import { fieldsOf, type EditableField, type FieldKind } from "./edit";
import type { FactoryTable } from "./store";

/** What the ops page's forms show: each editable field of a row with its current value as typed text. */

export interface FieldView {
  readonly table: FactoryTable;
  readonly id: string;
  readonly column: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly choices: readonly string[];
  readonly text: string;
}

type Row = Readonly<Record<string, unknown>>;

const major = (minor: number): string => (minor / 100).toFixed(2);
const percent = (bp: number): string => String(bp / 100);

function lines(value: unknown, format: (key: string, v: unknown) => string): string {
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries((value ?? {}) as Record<string, unknown>);
  return entries.map(([k, v]) => format(k, v)).join("\n");
}

/** The text a form shows for a stored value; the inverse of parseFieldInput. */
export function textOf(field: EditableField, row: Row): string {
  const value = row[field.column];
  if (field.kind === "costMoney") return value === null || value === undefined ? "" : `${major(Number(value))} ${String(row.cost_currency)}`;
  if (field.kind === "certifications") {
    return lines(value, (_, c) => {
      const cert = c as { name: string; expiresOn: string | null };
      return cert.expiresOn ? `${cert.name} = ${cert.expiresOn}` : cert.name;
    });
  }
  if (field.kind === "dutyLines") return lines(value, (code, bp) => `${code} = ${percent(Number(bp))}`);
  if (field.kind === "json") return JSON.stringify(value ?? {});
  if (value === null || value === undefined) return "";
  switch (field.kind) {
    case "money":
      return major(Number(value));
    // numeric(5, 2) in the database, so the form shows both decimal places whether the row arrived
    // with its scale intact (a string from PostgREST) or already through Number(), which drops it.
    case "optionalDecimal":
      return Number(value).toFixed(2);
    case "percent":
      return percent(Number(value));
    case "boolean":
    case "optionalBoolean":
      return value ? "yes" : "no";
    case "list":
      return (value as readonly string[]).join(", ");
    default:
      return String(value);
  }
}

export function fieldViews(table: FactoryTable, row: Row): readonly FieldView[] {
  return fieldsOf(table).map((field) => ({
    table,
    id: String(row.id),
    column: field.column,
    label: field.label,
    kind: field.kind,
    choices: field.choices ?? [],
    text: textOf(field, row),
  }));
}
