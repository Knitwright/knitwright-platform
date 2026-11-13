/**
 * THE VERSION HISTORY PANEL'S ROWS (plan v6 E5, decision 0149; `08` v3.7 "Version history", prototype e31).
 *
 * A design's versions are its saved spec versions (`spec_versions`), newest first, each with the
 * status the validation gate gave it (`design_statuses`, decision 0132). Every save is a version, so
 * there is no separate "autosave": the toggle **Show autosaves** hides the plain saves and keeps the
 * versions that mean something -- the current one, any with a status (validated, approved, ordered)
 * and any restore. A version that was **ordered** is locked: it is the one the factory made. Restoring
 * any version writes it again as a new version (`restoreVersionAction`); it never changes an order.
 */

export const VERSION_STATUSES = ["draft", "validated", "approved", "ordered"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export interface VersionInput {
  readonly version: number;
  readonly note: string;
  readonly restoredFrom: number | null;
  readonly createdAt: string;
}

export interface VersionRow {
  readonly version: number;
  readonly title: string;
  /** "2 Nov 16:05 · locked to an order" */
  readonly line: string;
  readonly current: boolean;
  readonly locked: boolean;
  readonly autosave: boolean;
  /** Restore is offered on every version but the current one. */
  readonly canRestore: boolean;
}

const STATUS_WORDS: Readonly<Record<Exclude<VersionStatus, "draft">, string>> = {
  validated: "Checked",
  approved: "Approved for ordering",
  ordered: "Ordered",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2 Nov 16:05" in UTC, so the server and the browser draw the same words. */
export function whenLine(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

const titleOf = (input: VersionInput, status: VersionStatus, current: boolean): string => {
  const label = status === "draft" ? (input.note.trim() || "Saved") : STATUS_WORDS[status];
  return current ? `Current version · v${input.version}` : `${label} · v${input.version}`;
};

/** The panel's rows, newest first, before the autosave filter. */
export function versionRows(inputs: readonly VersionInput[], statuses: Readonly<Record<number, VersionStatus>>, current: number): readonly VersionRow[] {
  return [...inputs]
    .sort((a, b) => b.version - a.version)
    .map((input) => {
      const status = statuses[input.version] ?? "draft";
      const isCurrent = input.version === current;
      const locked = status === "ordered";
      const facts = [whenLine(input.createdAt), locked ? "locked to an order" : null, status !== "draft" && isCurrent ? STATUS_WORDS[status] : null, input.restoredFrom !== null ? `restored from v${input.restoredFrom}` : null];
      return {
        version: input.version,
        title: titleOf(input, status, isCurrent),
        line: facts.filter((fact): fact is string => fact !== null && fact !== "").join(" · "),
        current: isCurrent,
        locked,
        autosave: !isCurrent && status === "draft" && input.restoredFrom === null,
        canRestore: !isCurrent,
      };
    });
}

/** The rows the toggle leaves. */
export const shownRows = (rows: readonly VersionRow[], showAutosaves: boolean): readonly VersionRow[] => (showAutosaves ? rows : rows.filter((row) => !row.autosave));

/** The panel's footnote, word for word. */
export const LOCK_NOTE = "Versions sent to the factory are locked. Restoring makes a new version; it never changes an order.";
