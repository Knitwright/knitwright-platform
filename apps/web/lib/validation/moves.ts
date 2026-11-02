import type { VersionStatus } from "./status";

/**
 * What the "Factory file" panel offers from each design status, in the order it draws them.
 *
 * It sits in a file of its own, and takes `VersionStatus` as a **type** only, because the panel is a
 * client component: `status.ts` holds a zod schema, and a client component that imports a value
 * from it ships all of zod to the browser (`tests/architecture/client-weight.test.ts`).
 *
 * The list is a subset of `status.ts`'s own `MOVES`: a person records that there are no blockers
 * today, accepts that version for ordering, or puts it back to draft. Moving to `ordered` is the
 * order's own screen, so it is never a button in this panel, and nothing moves out of `approved` or
 * `ordered` here, because `MOVES` allows neither back to draft.
 *
 * The panel used to hard-code two buttons and know three of the four statuses, so `approved` was a
 * state the route accepted and no screen could reach (code review of plan v5, item D-6). A test
 * holds every entry here to `canMove`, so this list cannot offer a move the rules refuse.
 */

/** The statuses this panel may ask for. Ordering is not one of them. */
export type PanelMove = Exclude<VersionStatus, "ordered">;

export interface StatusMove {
  readonly to: PanelMove;
  readonly label: string;
  /** True for a move that is only offered once nothing blocks an order. */
  readonly needsNoBlockers: boolean;
}

const PANEL_MOVES: Readonly<Record<VersionStatus, readonly StatusMove[]>> = {
  draft: [{ to: "validated", label: "Record no blockers today", needsNoBlockers: true }],
  validated: [
    { to: "approved", label: "Accept for ordering", needsNoBlockers: true },
    { to: "draft", label: "Back to draft", needsNoBlockers: false },
  ],
  approved: [],
  ordered: [],
};

export const panelMoves = (from: VersionStatus): readonly StatusMove[] => PANEL_MOVES[from];
