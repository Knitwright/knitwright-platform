import { clipNote } from "./notes";

/**
 * Every saved change is its own version, and versions are never changed or removed (the
 * database refuses: see the projects migration). Typing fourteen measurements therefore makes
 * fourteen versions. To keep the history and the tech pack's revision table readable, a run of
 * quick edits by one person is shown as one entry. Nothing stored changes: each version can still
 * be opened and restored on its own.
 *
 * A version joins the entry of the version after it when:
 * - the same person saved both, and that person is known;
 * - it was saved at most two minutes before the next one;
 * - the two are next to each other, with no version between them;
 * - neither is a restore or an undo, and it is not the first version of the design.
 */

/** The longest pause between two edits of one run. */
export const EDIT_GROUP_WINDOW_MS = 2 * 60 * 1000;

export interface GroupableVersion {
  readonly version: number;
  readonly note: string;
  readonly restoredFrom: number | null;
  /** When the version was saved, as an ISO date and time. */
  readonly createdAt: string;
  readonly createdBy?: string | null;
}

interface VersionGroup<T extends GroupableVersion = GroupableVersion> {
  /** The newest version of the run. Its design is the one the entry stands for. */
  readonly newest: T;
  /** Every version of the run, newest first. */
  readonly versions: readonly T[];
}

const joins = (older: GroupableVersion, newer: GroupableVersion): boolean => {
  if (older.version === 1 || newer.version !== older.version + 1) return false;
  if (older.restoredFrom !== null || newer.restoredFrom !== null) return false;
  if (!older.createdBy || older.createdBy !== newer.createdBy) return false;
  const pause = Date.parse(newer.createdAt) - Date.parse(older.createdAt);
  return pause >= 0 && pause <= EDIT_GROUP_WINDOW_MS;
};

/** The versions gathered into runs of quick edits, newest first. */
export function groupVersions<T extends GroupableVersion>(versions: readonly T[]): VersionGroup<T>[] {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version);
  return newestFirst.reduce<VersionGroup<T>[]>((groups, entry) => {
    const last = groups.at(-1);
    const oldest = last?.versions.at(-1);
    if (last && oldest && joins(entry, oldest)) {
      return [...groups.slice(0, -1), { newest: last.newest, versions: [...last.versions, entry] }];
    }
    return [...groups, { newest: entry, versions: [entry] }];
  }, []);
}

/** "Version 7", or "Versions 3 to 16" for a run. */
export function groupTitle(group: VersionGroup): string {
  const oldest = group.versions.at(-1) ?? group.newest;
  return group.versions.length === 1 ? `Version ${group.newest.version}` : `Versions ${oldest.version} to ${group.newest.version}`;
}

/** The note of a single change, or how many changes a run holds and the last of them. */
export function groupNote(group: VersionGroup): string {
  if (group.versions.length === 1) return group.newest.note;
  return clipNote(`${group.versions.length} changes in a row. The last: ${group.newest.note}`);
}

/** The note of a revision in the tech pack: the versions a run covers, and its last change. */
export function revisionNote(group: VersionGroup): string {
  if (group.versions.length === 1) return group.newest.note;
  return clipNote(`${groupTitle(group)}. The last change: ${group.newest.note}`);
}
