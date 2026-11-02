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
  type LaunchProjectView,
  type LaunchState,
  type MenuCommand,
  type TaskAction,
} from "@/lib/launch";
import { canRedo, canUndo } from "@/lib/launch";
import { saveLaunchVersionAction } from "@/lib/launch/actions";
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

const COLUMNS = "flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.75rem_20rem_minmax(0,1fr)] xl:grid-cols-[4.75rem_21rem_minmax(0,1fr)_21rem]";

const UNDO_TITLE =
  "Undo covers a board's place, size, name and settings, and the project's unit and colours. Adding or removing a board, or a connector, is a change to the canvas itself and is undone with its own control.";

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
    if (id === "save") return void saveLaunchVersionAction({ launchProjectId: project.id }).catch(() => null);
    if (id === "duplicate") {
      return selected
        ? shell.commands.addBoard(selected.kind, { x: selected.at.x + 40, y: selected.at.y + 40 })
        : shell.commands.addBoard("artboard", { x: 0, y: 0 });
    }
    return undefined;
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
          <p className="truncate font-mono text-xs text-chalk-muted">
            {project.boards.length === 1 ? "1 board" : `${project.boards.length} boards`}
            {selected ? ` · ${BOARDS[selected.kind].label} selected` : ""}
          </p>
        </div>
        <MainMenu projectId={project.id} unit={shell.state.unit} busy={busy} onUnit={shell.commands.setUnit} onCommand={command} />
      </header>

      {canEdit ? null : <Notice tone="info">You can look at this launch project. Only owners, admins and kit managers can change it.</Notice>}

      {shell.problem ? (
        <Notice tone="warn" role="alert">
          {shell.problem.text}
        </Notice>
      ) : null}

      <div className={COLUMNS}>
        <IconRail open={shell.state.rail} onOpen={shell.commands.openPanel} />
        <RailPanels open={shell.state.rail} />

        <div className="flex min-h-0 flex-col gap-3">
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
          <div title={UNDO_TITLE}>
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
        </div>

        <div className="flex min-h-0 flex-col lg:hidden xl:flex">
          <Inspector
            projectName={project.name}
            colours={project.colours}
            selection={page.selection}
            unit={shell.state.unit}
            presets={presets}
            busy={busy}
            lockNote={page.lockNote}
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
