"use client";

import { Notice } from "@/components/ui/Notice";
import {
  BOARDS,
  estimateRun,
  launchPageState,
  runLabel,
  runnable,
  type ArtboardPreset,
  type BoardKind,
  type LaunchCostSource,
  type LaunchPanelProps,
  type LaunchProjectView,
  type LaunchState,
  type MenuCommand,
  type TaskAction,
} from "@/lib/launch";
import { canRedo, canUndo } from "@/lib/launch";
import { BoardCanvas } from "./BoardCanvas";
import { BottomDock } from "./BottomDock";
import { IconRail } from "./IconRail";
import { Inspector } from "./Inspector";
import { MainMenu } from "./MainMenu";
import { RailPanels } from "./RailPanels";
import { TaskBar } from "./TaskBar";
import { useLaunchShell } from "./useLaunchShell";

export type LaunchShellProps = Readonly<{
  project: LaunchProjectView;
  presets: readonly ArtboardPreset[];
  credits: number | null;
  costs: LaunchCostSource;
  /** The state the address asked for, worked out on the server by `launchPageState`. */
  state: LaunchState;
  canEdit: boolean;
}>;

/* The breakout, as the editor shell has it: from lg up the shell is wider than the page column and
 * fills the screen below the studio header, so nothing scrolls but the panels. */
const FRAME =
  "flex flex-col gap-3 pb-28 lg:-mt-6 lg:mb-[-1.5rem] lg:h-[calc(100dvh-8rem)] lg:min-h-[30rem] lg:w-[min(100vw_-_2.5rem,96rem)] lg:ml-[calc(50%_-_min(50vw_-_1.25rem,48rem))] lg:pb-0";

/*
 * Four columns from lg up: the rail, the open rail panel, the canvas with its task bar and dock,
 * and the inspector. The two side panels are narrower on a small laptop than on a wide screen, so
 * the inspector is never taken away -- an artboard size and a board's own panel are not optional.
 * Below lg everything stacks, the canvas first, and the rail becomes a bar along the bottom.
 */
const COLUMNS =
  "flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.75rem_17rem_minmax(0,1fr)_17rem] xl:grid-cols-[4.75rem_21rem_minmax(0,1fr)_21rem]";

/**
 * The launch shell of the spec's Launch section: the left icon rail with its twelve panels, the
 * canvas of boards, the right inspector, the contextual task bar and the bottom prompt pill and
 * tool dock, under a header with the project's name and the main menu.
 *
 * The rail panels and each board kind's inspector are panels other workstreams fill
 * (`lib/launch/panels.ts`); until they land the shell draws a labelled placeholder for each.
 *
 * Every garment-locked rule is on the screen and not only in the code: a board with no Design board
 * behind it says so in the inspector, its Run button says there is nothing to run, and the task
 * bar's Remove background and Remix are off on a picture the platform drew.
 */
export function LaunchShell({ project, presets, credits, costs, state, canEdit }: LaunchShellProps) {
  const graph = { boards: project.boards, edges: project.edges };
  const shell = useLaunchShell({
    launchProjectId: project.id,
    boards: project.boards,
    graph,
    units: project.units,
    colours: project.colours,
    state,
    credits,
    costs,
  });
  const page = launchPageState({
    query: {
      panel: shell.state.rail,
      board: shell.state.boardId ?? undefined,
      image: shell.state.image ? "1" : undefined,
      tool: shell.state.tool,
      unit: shell.state.unit,
      zoom: String(shell.state.zoom),
    },
    project,
  });

  const selected = page.selection?.board ?? null;
  const estimate = selected ? estimateRun(graph, selected.id, costs) : null;
  const canRun = selected !== null && runnable(graph, selected.id).canRun;
  const busy = shell.busy || !canEdit;

  const command = (id: MenuCommand) => {
    // Save keeps the canvas as a version; Duplicate copies the selected board, or adds a fresh
    // artboard when nothing is selected. Settings is handled inside the menu itself.
    if (id === "save") return shell.saveVersion();
    if (id === "duplicate") {
      return selected
        ? shell.commands.addBoard(selected.kind, { x: selected.at.x + 40, y: selected.at.y + 40 })
        : shell.commands.addBoard("artboard", { x: 0, y: 0 });
    }
    return undefined;
  };

  /**
   * What a panel another workstream built is given, and all it is given: the project as read-only
   * facts and the commands it may ask for (`lib/launch/panels.ts`). Built once here so the rail's
   * panels and the selected board's inspector are handed the same thing.
   */
  const panel: LaunchPanelProps = {
    context: {
      project,
      selection: page.selection,
      credits,
      presets,
      unit: shell.state.unit,
      zoom: shell.state.zoom,
      dockTool: shell.state.tool,
      busy,
    },
    commands: shell.commands,
  };

  const action = (id: TaskAction) => {
    if (!selected) return;
    if (id === "remove") return shell.commands.removeBoard(selected.id);
    if (id === "duplicate") return shell.commands.addBoard(selected.kind, { x: selected.at.x + 40, y: selected.at.y + 40 });
    // Flatten, Upscale, Reframe, Remove background, Remix, Generate video and Download are the
    // panels' own work (L2 to L6). The shell offers them, says when they cannot be used, and hands
    // them over; it never does one itself.
    shell.commands.selectBoard(selected.id, true);
  };

  return (
    <div className={FRAME} data-testid="launch-shell">
      <header className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[1.75rem] px-4 py-2.5 lg:pl-5">
        <div className="min-w-0 flex-1 lg:flex-none lg:basis-72">
          <h1 className="truncate text-base font-medium tracking-[-0.01em] text-ink">{project.name}</h1>
          <p className="truncate font-mono text-xs text-ink-2">
            {project.boards.length === 1 ? "1 board" : `${project.boards.length} boards`}
            {selected ? ` · ${BOARDS[selected.kind].label} selected` : ""}
          </p>
        </div>
        <MainMenu projectId={project.id} unit={shell.state.unit} busy={busy} onUnit={shell.commands.setUnit} onCommand={command} />
      </header>

      {canEdit ? null : <Notice tone="info">You can look at this launch project. Only owners, admins and kit managers can change it.</Notice>}

      {shell.note ? (
        <div data-testid="launch-note">
          <Notice tone={shell.note.tone} role={shell.note.tone === "warn" ? "alert" : "status"}>
            {shell.note.text}
          </Notice>
        </div>
      ) : null}

      <div className={COLUMNS}>
        <IconRail open={shell.state.rail} onOpen={shell.commands.openPanel} />
        <RailPanels open={shell.state.rail} panel={panel} />

        <div className="order-first flex min-h-0 flex-col gap-3 lg:order-none">
          {page.taskBar ? <TaskBar bar={page.taskBar} busy={busy} onAdd={(kind: BoardKind) => shell.commands.addBoard(kind, { x: 0, y: 0 }, selected?.id)} onAction={action} /> : null}
          <BoardCanvas
            graph={graph}
            selectedId={shell.state.boardId}
            zoom={shell.state.zoom}
            busy={busy}
            empty={page.empty}
            onSelect={shell.commands.selectBoard}
            onAdd={(kind, fromBoardId) => shell.commands.addBoard(kind, { x: 0, y: 0 }, fromBoardId)}
          />
          <BottomDock
            tool={shell.state.tool}
            zoom={shell.state.zoom}
            credits={credits}
            estimate={estimate}
            runLabel={estimate ? runLabel(estimate) : null}
            canRun={canRun && !busy}
            canUndo={canUndo(shell.stack)}
            canRedo={canRedo(shell.stack)}
            busy={busy}
            prompt={shell.prompt}
            onPrompt={shell.setPrompt}
            onTool={shell.commands.chooseTool}
            onZoom={shell.commands.setZoom}
            onRun={() => selected && shell.commands.requestRun(selected.id)}
            onUndo={shell.commands.undo}
            onRedo={shell.commands.redo}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <Inspector
            projectName={project.name}
            colours={project.colours}
            selection={page.selection}
            unit={shell.state.unit}
            presets={presets}
            busy={busy}
            lockNote={page.lockNote}
            panel={panel}
            onUnit={shell.commands.setUnit}
            onSize={(size) => selected && shell.commands.resizeBoard(selected.id, size)}
            onColours={shell.commands.setProjectColours}
            onAddBoard={(kind) => shell.commands.addBoard(kind, { x: 0, y: 0 }, selected?.id)}
          />
        </div>
      </div>
    </div>
  );
}
