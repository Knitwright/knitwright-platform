import type { BoardKind } from "../boards";
import type { BoardLink, BoardView, LaunchProjectView } from "../types";

/** Boards and canvases for the tests of this directory. Nothing here reaches the database. */

export function board(id: string, kind: BoardKind, extra: Partial<BoardView> = {}): BoardView {
  return {
    id,
    kind,
    name: id,
    at: { x: 0, y: 0 },
    size: { width: 1080, height: 1350 },
    settings: {},
    inputVersion: null,
    outputFileId: null,
    outputRole: "asset",
    status: "empty",
    lastCostCredits: null,
    ruleId: "R-GAP-000",
    ...extra,
  };
}

export const link = (id: string, fromBoardId: string, toBoardId: string, inputIndex = 1): BoardLink => ({ id, fromBoardId, toBoardId, inputIndex });

/** A design board carrying the design it shows, as the shell saves it in the board's settings. */
export const designBoard = (id: string, projectId = "project-1", version = 3): BoardView =>
  board(id, "design", { settings: { designProjectId: projectId }, inputVersion: version });

export const ready = (one: BoardView, fileId = "file-1"): BoardView => ({ ...one, status: "ready", outputFileId: fileId });

export function project(boards: readonly BoardView[], edges: readonly BoardLink[] = [], extra: Partial<LaunchProjectView> = {}): LaunchProjectView {
  return {
    id: "launch-1",
    brandId: "brand-1",
    name: "Home kit launch",
    units: "px",
    colours: [{ hex: "#0b1f4b", name: "Club navy" }],
    designProjectId: "project-1",
    boards,
    edges,
    updatedAt: "2026-12-01T10:00:00.000Z",
    ...extra,
  };
}
