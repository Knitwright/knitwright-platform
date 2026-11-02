"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  affordable,
  BOARDS,
  canConnect,
  estimateRun,
  RAIL_ITEMS,
  pushed,
  redone,
  runnable,
  started,
  undone,
  withLaunchState,
  type ArtboardUnit,
  type BoardKind,
  type BoardView,
  type DockTool,
  type Graph,
  type LaunchAsset,
  type LaunchCommands,
  type LaunchCostSource,
  type LaunchPanelId,
  type LaunchState,
  type Point,
  type ProjectColour,
  type RailId,
  type Size,
  type UndoStack,
} from "@/lib/launch";
import {
  connectLaunchBoardsAction,
  disconnectLaunchBoardsAction,
  recordBoardOutputAction,
  removeBoardAction,
  saveBoardAction,
  saveLaunchProjectAction,
  saveLaunchVersionAction,
} from "@/lib/launch/actions";

/**
 * The launch shell's own state and the one place every command of the contract is carried out.
 *
 * Where a change is shown lives in the address, as the editor's shell already holds
 * (`components/studio/editor/useShell.ts`): the open rail panel, the selected board, the dock
 * tool, the unit and the zoom. A reload or a shared link therefore opens the same canvas in the
 * same state, and the server works out the rest.
 *
 * `commands` satisfies `LaunchCommands`, so the contract L2 to L6 code against and the shell that
 * carries it out cannot drift apart without the compiler saying so.
 *
 * UNDO COVERS WHAT A BOARD CARRIES: its place, its size, its name and its own settings, and the
 * project's unit and palette. Adding or removing a board, and drawing or cutting a connector, are
 * changes to the canvas itself and start the stack again: a board put back under a new id is not
 * the board that was removed, and the shell will not pretend it is. Each of those has its own
 * control instead -- Delete on the task bar, and the connector's own menu (decision 0091).
 */

type BoardFields = Readonly<{ name: string; x: number; y: number; width: number; height: number; settings: Readonly<Record<string, unknown>>; inputVersion: number | null }>;

interface Frame {
  readonly boards: Readonly<Record<string, BoardFields>>;
  readonly units: ArtboardUnit;
  readonly colours: readonly ProjectColour[];
}

type Reply = { success: boolean; error?: { message: string } } | null;

const fieldsOf = (board: BoardView): BoardFields => ({
  name: board.name,
  x: board.at.x,
  y: board.at.y,
  width: board.size.width,
  height: board.size.height,
  settings: board.settings,
  inputVersion: board.inputVersion,
});

const frameOf = (boards: readonly BoardView[], units: ArtboardUnit, colours: readonly ProjectColour[]): Frame => ({
  boards: Object.fromEntries(boards.map((board) => [board.id, fieldsOf(board)])),
  units,
  colours,
});

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export interface ShellInput {
  readonly launchProjectId: string;
  readonly boards: readonly BoardView[];
  readonly graph: Graph;
  readonly units: ArtboardUnit;
  readonly colours: readonly ProjectColour[];
  readonly state: LaunchState;
  readonly credits: number | null;
  readonly costs: LaunchCostSource;
}

/** What the shell is telling the person now: a refusal to act on, or a change that landed. */
export type Note = Readonly<{ tone: "warn" | "ok"; text: string }> | null;

export function useLaunchShell(input: ShellInput) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState(input.state);
  const [stack, setStack] = useState<UndoStack<Frame>>(() => started(frameOf(input.boards, input.units, input.colours)));
  const [note, setNote] = useState<Note>(null);
  const [prompt, setPrompt] = useState("");
  const [pending, start] = useTransition();

  /** Rewrites the address, keeping every other parameter and the #hash a link may carry. */
  const go = useCallback(
    (next: LaunchState) => {
      setState(next);
      start(() => {
        router.replace(`${path}${withLaunchState(window.location.search, next)}${window.location.hash}` as Route, { scroll: false });
      });
    },
    [path, router],
  );

  /** One write, with the shell's own message when the server refuses it. */
  const send = useCallback(
    (run: () => Promise<Reply>) => {
      start(async () => {
        const reply = await run().catch(() => null);
        if (!reply) return setNote({ tone: "warn", text: "That change could not be saved. Check your connection and try again." });
        if (!reply.success) return setNote({ tone: "warn", text: reply.error?.message ?? "That change was refused." });
        setNote(null);
        router.refresh();
      });
    },
    [router],
  );

  const boardById = useCallback((boardId: string): BoardView | null => input.boards.find((one) => one.id === boardId) ?? null, [input.boards]);

  const saveFields = useCallback(
    (board: BoardView, fields: BoardFields) => {
      setStack((current) => pushed(current, { ...current.present, boards: { ...current.present.boards, [board.id]: fields } }));
      send(() => saveBoardAction({ launchProjectId: input.launchProjectId, boardId: board.id, kind: board.kind, ...fields }));
    },
    [input.launchProjectId, send],
  );

  /** Puts a frame back: every board whose fields differ, and the project when its own differ. */
  const restore = useCallback(
    (frame: Frame) => {
      start(async () => {
        for (const board of input.boards) {
          const want = frame.boards[board.id];
          if (!want || same(want, fieldsOf(board))) continue;
          await saveBoardAction({ launchProjectId: input.launchProjectId, boardId: board.id, kind: board.kind, ...want }).catch(() => null);
        }
        if (frame.units !== input.units || !same(frame.colours, input.colours)) {
          await saveLaunchProjectAction({ launchProjectId: input.launchProjectId, name: null, units: frame.units, colours: [...frame.colours] }).catch(() => null);
        }
        router.refresh();
      });
    },
    [input.boards, input.colours, input.launchProjectId, input.units, router],
  );

  /** A change to the canvas itself. The stack starts again from here (see the note above). */
  const structural = useCallback(
    (run: () => Promise<Reply>) => {
      setStack(started(frameOf(input.boards, input.units, input.colours)));
      send(run);
    },
    [input.boards, input.colours, input.units, send],
  );

  /**
   * A run the shell has checked but does not carry out. The garment lock and the cost are the
   * shell's; the paid call itself belongs to the workstream that owns the board's capability, so
   * the shell says who will do it rather than pretending to have done it.
   */
  const askToRun = useCallback(
    (boardId: string, downstream: boolean) => {
      const board = boardById(boardId);
      if (!board) return;
      const verdict = runnable(input.graph, boardId);
      if (!verdict.canRun) return setNote({ tone: "warn", text: verdict.reason });
      const estimate = estimateRun(input.graph, boardId, input.costs, downstream);
      const purse = affordable(estimate, input.credits);
      if (!purse.affordable) return setNote({ tone: "warn", text: purse.reason });
      setNote({
        tone: "ok",
        text: `This ${BOARDS[board.kind].label} board is ready to run for ${estimate.credits === 0 ? "nothing" : `${estimate.credits} credits`}, and nothing has been spent. The panel that runs it is not built yet.`,
      });
    },
    [boardById, input.costs, input.credits, input.graph],
  );

  const commands = {
    addBoard: (kind: BoardKind, at: Point, fromBoardId?: string) =>
      structural(async () => {
        const added = await saveBoardAction({ launchProjectId: input.launchProjectId, boardId: null, kind, name: "", x: at.x, y: at.y, settings: {}, inputVersion: null }).catch(() => null);
        if (!added?.success || !fromBoardId) return added;
        return connectLaunchBoardsAction({ launchProjectId: input.launchProjectId, fromBoardId, toBoardId: added.data.id, inputIndex: 1 });
      }),

    connect: (fromBoardId: string, toBoardId: string, inputIndex: number) => {
      const verdict = canConnect(input.graph, fromBoardId, toBoardId, inputIndex);
      if (!verdict.allowed) return setNote({ tone: "warn", text: verdict.reason });
      structural(() => connectLaunchBoardsAction({ launchProjectId: input.launchProjectId, fromBoardId, toBoardId, inputIndex }));
    },

    disconnect: (edgeId: string) => structural(() => disconnectLaunchBoardsAction({ launchProjectId: input.launchProjectId, edgeId })),

    removeBoard: (boardId: string) => structural(() => removeBoardAction({ launchProjectId: input.launchProjectId, boardId })),

    selectBoard: (boardId: string | null, image = false) => go({ ...state, boardId, image }),

    moveBoard: (boardId: string, at: Point) => {
      const board = boardById(boardId);
      if (board) saveFields(board, { ...fieldsOf(board), x: at.x, y: at.y });
    },

    resizeBoard: (boardId: string, size: Size) => {
      const board = boardById(boardId);
      if (board) saveFields(board, { ...fieldsOf(board), width: size.width, height: size.height });
    },

    setBoardSettings: (boardId: string, settings: Readonly<Record<string, unknown>>) => {
      const board = boardById(boardId);
      if (board) saveFields(board, { ...fieldsOf(board), settings });
    },

    requestRun: (boardId: string) => askToRun(boardId, false),
    requestRunDownstream: (boardId: string) => askToRun(boardId, true),

    /**
     * A finished picture for a board. The role comes from the asset itself, so a generated picture
     * is recorded as scenery; the action and the database refuse anything else again.
     */
    offerAsset: (boardId: string, asset: LaunchAsset) =>
      send(() =>
        recordBoardOutputAction({
          launchProjectId: input.launchProjectId,
          boardId,
          asset: {
            role: asset.role,
            provenance: asset.provenance,
            fileId: asset.file.fileId,
            showsPerson: asset.provenance === "generated" ? asset.showsPerson : false,
          },
          status: "ready",
          credits: null,
        }),
      ),

    setProjectColours: (colours: readonly ProjectColour[]) => {
      setStack((current) => pushed(current, { ...current.present, colours }));
      send(() => saveLaunchProjectAction({ launchProjectId: input.launchProjectId, name: null, units: null, colours: [...colours] }));
    },

    setUnit: (unit: ArtboardUnit) => {
      setStack((current) => pushed(current, { ...current.present, units: unit }));
      go({ ...state, unit });
      send(() => saveLaunchProjectAction({ launchProjectId: input.launchProjectId, name: null, units: unit, colours: null }));
    },

    /**
     * A rail panel opens here. A board's own panel opens by selecting that board, so asking for one
     * by name leaves the rail where it is rather than moving it somewhere nobody asked for.
     */
    openPanel: (id: LaunchPanelId) => {
      if ((RAIL_ITEMS as readonly string[]).includes(id)) go({ ...state, rail: id as RailId });
    },

    chooseTool: (tool: DockTool) => go({ ...state, tool }),
    setZoom: (percent: number) => go({ ...state, zoom: percent }),

    undo: () => {
      const next = undone(stack);
      setStack(next);
      restore(next.present);
    },

    redo: () => {
      const next = redone(stack);
      setStack(next);
      restore(next.present);
    },
  } satisfies LaunchCommands;

  /**
   * The main menu's Save. Not part of the contract: a panel never saves a version of the whole
   * project. It says which version it wrote, so the person can find it in the history.
   */
  const saveVersion = useCallback(() => {
    start(async () => {
      const reply = await saveLaunchVersionAction({ launchProjectId: input.launchProjectId }).catch(() => null);
      if (!reply) return setNote({ tone: "warn", text: "The version could not be saved. Check your connection and try again." });
      if (!reply.success) return setNote({ tone: "warn", text: reply.error.message });
      setNote({ tone: "ok", text: `Version ${reply.data.version} saved. It is in the version history.` });
    });
  }, [input.launchProjectId]);

  return { state, stack, commands, note, saveVersion, prompt, setPrompt, setNote, busy: pending };
}

export type LaunchShellState = ReturnType<typeof useLaunchShell>;
