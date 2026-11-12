import type { Workspace } from "./nav";

/**
 * What the shell needs to know about the workspace, read so that a failed read never stops a page
 * opening (decision 0138).
 *
 * - **A club** is a brand whose welcome-page answer was a club or a school, or whose Brand Studio
 *   category makes it one (`kindOf` in `lib/brand-studio/words.ts`). Team shows on the rail for it.
 * - **Set up** means the brand has saved its details in Brand Studio (the completion's first step).
 *   Until then the brand pill carries the gold "New" tag.
 */

const CLUB_TYPES: readonly string[] = ["club", "school"];

export interface WorkspaceFacts {
  /** The organisation type from the welcome page, or null. */
  readonly organisationType: string | null;
  /** The Brand Studio kind. */
  readonly kind: "club" | "brand";
  /** True once Brand Studio's details step is done. */
  readonly detailsDone: boolean;
}

export const workspaceOf = (facts: WorkspaceFacts): Workspace => ({
  isClub: facts.kind === "club" || CLUB_TYPES.includes(facts.organisationType ?? ""),
  setUp: facts.detailsDone,
});

/** When the facts cannot be read: no Team item, and no "New" tag nagging about a read that failed. */
export const UNKNOWN_WORKSPACE: Workspace = { isClub: false, setUp: true };

/** Reads the facts and never throws: a failed read is reported and gives `UNKNOWN_WORKSPACE`. */
export const loadWorkspace = async (read: () => Promise<WorkspaceFacts>, report: (error: unknown) => void): Promise<Workspace> => {
  try {
    return workspaceOf(await read());
  } catch (error) {
    report(error);
    return UNKNOWN_WORKSPACE;
  }
};
