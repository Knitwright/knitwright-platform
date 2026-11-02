/**
 * The screen's own model: everything the import panel shows, worked out on the server, so the
 * component that renders it decides nothing and computes nothing.
 *
 * It is written to the bar the owner set for this wave, and each part of that bar is a field here:
 *
 * - an import takes about a minute, so `stages` holds all six from the start, each with its own
 *   line of words, and `progress` says "Stage 3 of 6" — a person always knows what is happening;
 * - every group has a real `empty` state naming the one action that fills it;
 * - a site that cannot be read gives an `error` that says **why** (unreachable, blocked by
 *   robots.txt, too slow, not https) and what to do, with `retry` only where retrying may help;
 * - every row carries its own two buttons, so an import is never all or nothing;
 * - `rights` is a tick that starts false and is required before any picture is kept;
 * - `completion` explains what is missing, not just a number.
 *
 * No zod and no `sharp` here, so a client component may import it
 * (tests/architecture/client-weight.test.ts).
 */

import { completionOf, stillToDo, WEIGHT_SOURCE } from "../completion";
import type { BrandRecord } from "../types";
import { countOf, itemsOfKind, whyNoUploads } from "./decisions";
import type { ImportItem, ImportProposal, ImportRefusal, ItemKind, StageReport } from "./types";
import {
  DECISION_LABELS,
  EMPTY_IMPORT,
  IMPORT_STAGES,
  ITEM_KIND_LABELS,
  NOTHING_KEPT_YET,
  STAGE_EMPTY,
  STAGE_LABELS,
  STAGE_RUNNING,
} from "./words";

/** One line of the progress list. `words` is what to show now, whatever the status. */
export interface StageLine {
  readonly stage: StageReport["stage"];
  readonly label: string;
  readonly status: StageReport["status"];
  readonly words: string;
  readonly found: number | null;
  /** Shown to a screen reader as the stage's state, in words rather than a colour. */
  readonly said: string;
}

/** How far through the minute the run is, in words a person can act on. */
export interface Progress {
  readonly percent: number;
  readonly running: boolean;
  readonly summary: string;
}

/** One group of rows: the logos, the colours, the fonts, the graphics, the visual style. */
export interface ItemGroup {
  readonly kind: ItemKind;
  readonly heading: string;
  readonly rows: readonly ImportItem[];
  readonly keptCount: number;
  /** The real empty state: what is not there, and the one action that fills it. */
  readonly empty: string | null;
  /** The label on the shortcut above the group, or null when there is nothing to shortcut. */
  readonly keepAll: string | null;
}

export interface RightsRow {
  readonly text: string;
  readonly ask: string;
  readonly ticked: boolean;
  /** True when a picture is being kept, so the tick is the thing standing in the way. */
  readonly needed: boolean;
  /** Why nothing will be uploaded, or null when something will. */
  readonly because: string | null;
}

export interface CompletionView {
  readonly percent: number;
  readonly source: string;
  /** What is missing, one line each. Empty when nothing is. */
  readonly missing: readonly string[];
}

export interface ImportView {
  readonly url: string;
  readonly host: string;
  readonly stages: readonly StageLine[];
  readonly progress: Progress;
  readonly groups: readonly ItemGroup[];
  readonly rights: RightsRow;
  readonly keptCount: number;
  readonly pendingCount: number;
  readonly decisionLabels: typeof DECISION_LABELS;
  /** The line that says nothing of the site is kept. Shown wherever a picture is offered. */
  readonly promise: string;
}

const SAID: Readonly<Record<StageReport["status"], string>> = {
  pending: "Waiting",
  running: "Working",
  done: "Done",
  empty: "Nothing found",
  skipped: "Left out",
  failed: "Could not be done",
};

const wordsFor = (report: StageReport): string => {
  if (report.status === "running") return STAGE_RUNNING[report.stage];
  if (report.status === "done") return `${report.found} found.`;
  if (report.status === "pending") return STAGE_RUNNING[report.stage];
  return report.because ?? STAGE_EMPTY[report.stage];
};

export const stageLines = (reports: readonly StageReport[]): readonly StageLine[] =>
  reports.map((report) => ({
    stage: report.stage,
    label: STAGE_LABELS[report.stage],
    status: report.status,
    words: wordsFor(report),
    found: report.found,
    said: SAID[report.status],
  }));

const SETTLED_STATES: readonly StageReport["status"][] = ["done", "empty", "skipped", "failed"];

/** "Stage 3 of 6 · Reading your colours", or what the run ended as. */
export function progressOf(reports: readonly StageReport[]): Progress {
  const settled = reports.filter((report) => SETTLED_STATES.includes(report.status)).length;
  const running = reports.find((report) => report.status === "running");
  const percent = Math.round((settled / IMPORT_STAGES.length) * 100);
  if (running) return { percent, running: true, summary: `Stage ${settled + 1} of ${IMPORT_STAGES.length} · ${STAGE_LABELS[running.stage]}` };
  const done = settled === IMPORT_STAGES.length;
  return { percent, running: false, summary: done ? `All ${IMPORT_STAGES.length} stages finished.` : `${settled} of ${IMPORT_STAGES.length} stages finished.` };
}

/** What to do when a group found nothing. Always one action, never a shrug. */
const EMPTY_ACTION: Readonly<Record<ItemKind, string>> = {
  logo: STAGE_EMPTY.logos,
  colour: STAGE_EMPTY.colours,
  font: STAGE_EMPTY.fonts,
  graphic: STAGE_EMPTY.graphics,
  style: STAGE_EMPTY.style,
};

const groupOf = (proposal: ImportProposal, kind: ItemKind): ItemGroup => {
  const rows = itemsOfKind(proposal, kind);
  const kept = rows.filter((row) => row.decision === "accepted").length;
  const waiting = rows.filter((row) => row.decision === "pending").length;
  return {
    kind,
    heading: `${ITEM_KIND_LABELS[kind]}${rows.length === 0 ? "" : ` (${rows.length})`}`,
    rows,
    keptCount: kept,
    empty: rows.length === 0 ? EMPTY_ACTION[kind] : null,
    keepAll: waiting > 1 ? `Keep all ${waiting}` : null,
  };
};

const rightsRow = (proposal: ImportProposal): RightsRow => {
  const because = whyNoUploads(proposal);
  const pictures = itemsOfKind(proposal, "logo").concat(itemsOfKind(proposal, "graphic"));
  return {
    text: proposal.rights.text,
    ask: proposal.rights.ask,
    ticked: proposal.rights.ticked,
    needed: pictures.some((row) => row.decision === "accepted"),
    because,
  };
};

/** Every group of the proposal, in the order the brand page's tabs run. */
export const groupsOf = (proposal: ImportProposal): readonly ItemGroup[] =>
  (["logo", "colour", "font", "graphic", "style"] as const).map((kind) => groupOf(proposal, kind));

/** Everything the import panel shows for one proposal. */
export const importView = (proposal: ImportProposal): ImportView => ({
  url: proposal.url,
  host: proposal.host,
  stages: stageLines(proposal.stages),
  progress: progressOf(proposal.stages),
  groups: groupsOf(proposal),
  rights: rightsRow(proposal),
  keptCount: countOf(proposal, "accepted"),
  pendingCount: countOf(proposal, "pending"),
  decisionLabels: DECISION_LABELS,
  promise: NOTHING_KEPT_YET,
});

/**
 * The completion % with what is missing beside it, which is the whole point of showing it: a number
 * on its own tells a brand nothing about what to do next.
 */
export const completionView = (record: BrandRecord): CompletionView => {
  const completion = completionOf(record);
  return { percent: completion.percent, source: WEIGHT_SOURCE, missing: stillToDo(completion).map((step) => `${step.label}: ${step.asks}`) };
};

/** What the panel shows before anything has been pasted: the one action that fills it. */
export const emptyView = (): typeof EMPTY_IMPORT => EMPTY_IMPORT;

/** What the panel shows when a site could not be read: why, what to do, and whether to offer again. */
export const errorView = (refusal: ImportRefusal): Readonly<{ heading: string; body: string; retry: string | null }> => ({
  heading: "Your site could not be read",
  body: refusal.message,
  retry: refusal.canRetry ? "Try again" : null,
});
