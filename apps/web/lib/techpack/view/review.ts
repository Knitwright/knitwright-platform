import { GAP_RULE } from "@/lib/kpp/model";
import type { PomRow } from "./measurements";
import { emptyCellsOf, cellsOf, type TabView, type ViewTable } from "./rows";
import type { TechPackTabId } from "./tabs";

/**
 * The **Review** tab (spec F-S6): "Every field still 'Needs your input', plus the F-G2 pre-export
 * check. Export is blocked until clear; no `[TBC]` is allowed."
 *
 * The list of checks is F-G2's own (`docs/spec/02-features.md` F-G2), and the production package
 * runs the same list over the package it is about to write (`lib/kpp/gate.ts`, X5, decision 0070).
 * This one runs it over the tech pack view, which is what the person is looking at, so the editor
 * can say what is wrong before anything is exported.
 *
 * Four of F-G2's items — the colour gamut, the print resolution, the bleed and the moderation
 * status — are read off files and uploads that the tech pack view does not hold. They are listed
 * with where they are read instead of being reported as clear, because a check that did not run is
 * not a check that passed. They do not block on this tab; the export itself and the production
 * package's own gate still refuse on them.
 */

export type ReviewItem = Readonly<{
  tabId: TechPackTabId;
  tabLabel: string;
  cellId: string;
  label: string;
  ruleId: string;
}>;

export type CheckState = "clear" | "blocked" | "read-elsewhere";

export type CheckLine = Readonly<{
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  ruleId: string;
}>;

export type ReviewView = Readonly<{
  /** Every field of every tab that nothing fills yet, in tab order. */
  items: readonly ReviewItem[];
  checks: readonly CheckLine[];
  /** True while anything on this tab blocks the export (spec F-S6). */
  exportBlocked: boolean;
  /** One line for the top of the tab and for the Export panel's own refusal. */
  summary: string;
}>;

/** The text F-G2 forbids anywhere in a tech pack. */
const TBC = "[TBC]";

const clear = (id: string, label: string, detail: string, ruleId: string): CheckLine => ({ id, label, state: "clear", detail, ruleId });
const blocked = (id: string, label: string, detail: string, ruleId: string): CheckLine => ({ id, label, state: "blocked", detail, ruleId });
const elsewhere = (id: string, label: string, detail: string, ruleId: string): CheckLine => ({
  id,
  label,
  state: "read-elsewhere",
  detail,
  ruleId,
});

const itemsOf = (tabs: readonly TabView[]): readonly ReviewItem[] =>
  tabs.flatMap((view) =>
    emptyCellsOf(view).map((entry) => ({
      tabId: view.id,
      tabLabel: view.label,
      cellId: entry.id,
      label: entry.label,
      ruleId: entry.ruleId,
    })),
  );

/** Every cell of every tab whose text holds `[TBC]`, which F-G2 allows nowhere. */
const tbcIn = (tabs: readonly TabView[]): readonly string[] =>
  tabs.flatMap((view) => cellsOf(view).filter((entry) => (entry.text ?? "").toUpperCase().includes(TBC)).map((entry) => entry.label));

function fieldCheck(items: readonly ReviewItem[]): CheckLine {
  const label = "No field is waiting for you";
  if (items.length === 0) return clear("fields", label, "Every field of every tab has a value.", GAP_RULE);
  const first = items[0];
  const more = items.length === 1 ? "" : ` and ${items.length - 1} more`;
  return blocked("fields", label, `${first?.tabLabel}: ${first?.label}${more}.`, first?.ruleId ?? GAP_RULE);
}

function tbcCheck(tabs: readonly TabView[]): CheckLine {
  const found = tbcIn(tabs);
  const label = "No field reads [TBC]";
  return found.length === 0
    ? clear("tbc", label, "No field holds that text.", GAP_RULE)
    : blocked("tbc", label, `${found.length} field(s) hold that text, starting with ${found[0]}.`, GAP_RULE);
}

/**
 * The points of measure: every one needs a value in every size and a tolerance in both directions.
 * A missing tolerance blocks and is never filled in from the spec's placeholders (decision 18).
 */
function pomCheck(rows: readonly PomRow[], sizes: readonly string[]): CheckLine {
  const label = "Every point of measure is complete";
  if (rows.length === 0) return blocked("poms", label, "No point of measure is on the table.", GAP_RULE);
  const graded = rows.filter((row) => !row.isExtra);
  const noValue = graded.filter((row) => row.values.some((value) => value.text === null));
  const noTolerance = graded.filter((row) => row.tolMinus === null || row.tolPlus === null);
  if (noValue.length === 0 && noTolerance.length === 0) {
    return clear("poms", label, `${graded.length} point(s) of measure, each with a value in all ${sizes.length} size(s) and a tolerance.`, graded[0]?.ruleId ?? GAP_RULE);
  }
  const first = noValue[0] ?? noTolerance[0];
  const what = noValue.length > 0 ? "has no value in every size" : "has no tolerance";
  return blocked("poms", label, `Point ${first?.letter} ${what}.`, first?.ruleId ?? GAP_RULE);
}

/** The bill of materials: at least a fabric line, and no empty cell on any line. */
function bomCheck(tables: readonly ViewTable[]): CheckLine {
  const label = "The bill of materials is complete";
  const fabrics = tables.find((entry) => entry.id === "fabrics");
  if (!fabrics || fabrics.rows.length === 0) return blocked("bom", label, "There is no fabric line.", GAP_RULE);
  const empty = tables.flatMap((entry) => entry.rows.filter((row) => row.cells.some((item) => item.text === null)).map((row) => `${entry.title}: ${row.label}`));
  return empty.length === 0
    ? clear("bom", label, `${tables.reduce((count, entry) => count + entry.rows.length, 0)} line(s), each one filled in.`, GAP_RULE)
    : blocked("bom", label, `${empty.length} line(s) are not filled in, starting with ${empty[0]}.`, GAP_RULE);
}

/** The labels of the destination market, which F-G2 wants per market. */
function labelCheck(labels: TabView | undefined): CheckLine {
  const label = "A label is present for the destination market";
  const empty = labels ? emptyCellsOf(labels) : [];
  return empty.length === 0 && labels !== undefined
    ? clear("labels", label, "Every label field has a value.", "R-LAB-002")
    : blocked("labels", label, `${empty.length} label field(s) are waiting for you.`, "R-LAB-002");
}

export type ReviewInput = Readonly<{
  tabs: readonly TabView[];
  poms: readonly PomRow[];
  sizes: readonly string[];
  /** The Materials tab's tables, read for the F-G2 bill-of-materials item. */
  bomTables: readonly ViewTable[];
}>;

export function buildReview(input: ReviewInput): ReviewView {
  const items = itemsOf(input.tabs);
  const checks: readonly CheckLine[] = [
    fieldCheck(items),
    tbcCheck(input.tabs),
    pomCheck(input.poms, input.sizes),
    bomCheck(input.bomTables),
    labelCheck(input.tabs.find((view) => view.id === "labels")),
    elsewhere("gamut", "The colours are inside the printable range", "Estimated when the print files are made; it is not read on this tab.", "R-SUB-003"),
    elsewhere("dpi", "Every print file is above the minimum resolution", "Read from the print files when they are made; it is not read on this tab.", "R-SUB-001"),
    elsewhere("bleed", "Every print file carries the bleed", "Read from the print files when they are made; it is not read on this tab.", "R-SUB-002"),
    elsewhere("moderation", "Every upload has been through moderation", "Read from the upload's own record; it is not read on this tab.", GAP_RULE),
  ];
  const stops = checks.filter((check) => check.state === "blocked");
  return { items, checks, exportBlocked: stops.length > 0, summary: summaryFor(items.length, stops.length) };
}

function summaryFor(waiting: number, stops: number): string {
  if (stops === 0) return "Nothing on this tab stops the export.";
  const fields = waiting === 1 ? "1 field is waiting for you" : `${waiting} fields are waiting for you`;
  const list = stops === 1 ? "1 check stops the export" : `${stops} checks stop the export`;
  return `${fields}; ${list}.`;
}

/** What the Export panel shows instead of a download while the Review tab is not clear. */
export const EXPORT_BLOCKED_REASON = "Finish the Review tab first: the export is held while a check stops it.";
