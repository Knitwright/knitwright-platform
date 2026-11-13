"use client";

import { CanvasStoreProvider, useCanvas, useCanvasStore } from "@/components/canvas/CanvasStore";
import { MarketingServicesProvider, type MarketingServices } from "@/components/marketing/services";
import { ProjectActions, ProjectPanels } from "@/components/order-boards/ProjectActions";
import { zoomPercent, type GarmentPreview } from "@/lib/canvas";
import { Notice } from "@/components/ui/Notice";
import { boardFilePath, flowCostSource, offeredBar, TASK_STEPS } from "@/lib/flows";
import {
  BOARDS,
  estimateRun,
  launchPageState,
  runLabel,
  runnable,
  type ArtboardPreset,
  type BoardKind,
  type BoardView,
  type LaunchCostSource,
  type LaunchPanelProps,
  type LaunchProjectView,
  type LaunchState,
  type MenuCommand,
  type TaskAction,
} from "@/lib/launch";
import { canRedo, canUndo } from "@/lib/launch";
import { writeMarketingCopyAction } from "@/lib/marketing/actions";
import { MARKETING_RULE } from "@/lib/marketing";
// Types only: `copy/write` carries zod, and a value import would ship it to the browser.
import type { WriteRequest, WriteResult } from "@/lib/marketing/copy/write";
import { renderMockupBoardAction } from "@/lib/mockups/actions";
import { BoardCanvas } from "./BoardCanvas";
import { BottomDock } from "./BottomDock";
import { IconRail } from "./IconRail";
import { Inspector } from "./Inspector";
import { MainMenu } from "./MainMenu";
import { drawnPictures, type MarketingShellData } from "./marketing-services";
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
  /** What the marketing panels need from outside the canvas (decision 0094, `marketing-services.ts`). */
  marketing: MarketingShellData;
  /** What each garment board on the one canvas shows, by design id (decision 0145). */
  garments?: Readonly<Record<string, GarmentPreview | null>>;
}>;

/* The breakout, as the editor shell has it: from lg up the shell is wider than the page column and
 * fills the screen below the studio header, so nothing scrolls but the panels. */
const FRAME =
  "flex flex-col gap-3 pb-28 lg:-mt-6 lg:mb-[-1.5rem] lg:h-[calc(100dvh-8rem)] lg:min-h-[30rem] lg:w-[min(var(--shell-vw,100vw)_-_2.5rem,96rem)] lg:ml-[calc(50%_-_min(var(--shell-vw,100vw)/2_-_1.25rem,48rem))] lg:pb-0";

/*
 * Four columns from lg up: the rail, the open rail panel, the canvas with its task bar and dock,
 * and the inspector. The two side panels are narrower on a small laptop than on a wide screen, so
 * the inspector is never taken away -- an artboard size and a board's own panel are not optional.
 * Below lg everything stacks, the canvas first, and the rail becomes a bar along the bottom.
 */
const COLUMNS =
  "flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.75rem_17rem_minmax(0,1fr)_17rem] xl:grid-cols-[4.75rem_21rem_minmax(0,1fr)_21rem]";

const WRITE_FAILED = "Write for me could not be reached. Check your connection and try again.";

/**
 * The launch shell of the spec's Launch section: the left icon rail with its twelve panels, the
 * canvas of boards, the right inspector, the contextual task bar and the bottom prompt pill and
 * tool dock, under a header with the project's name and the main menu.
 *
 * The rail panels and each board kind's inspector are panels other workstreams fill
 * (`lib/launch/panels.ts`). L2's mockups, L4's marketing panels, L5's AI video board and L6's info
 * card, run summary and canvas are mounted; L3's AI image boards, L7's uploads and brand and L8's
 * templates and likes still draw a labelled placeholder.
 *
 * Every garment-locked rule is on the screen and not only in the code: a board with no Design board
 * behind it says so in the inspector, its Run button says there is nothing to run, and the task
 * bar's Remix is off on a picture the platform drew.
 */
export function LaunchShell(props: LaunchShellProps) {
  // The one canvas's store (decision 0145): the view and the selection, for the canvas and for
  // everything later built around it.
  return (
    <CanvasStoreProvider>
      <ShellBody {...props} />
    </CanvasStoreProvider>
  );
}

function ShellBody({ project, presets, credits, costs, state, canEdit, marketing, garments = {} }: LaunchShellProps) {
  const store = useCanvasStore();
  const percent = useCanvas((now) => zoomPercent(now.viewport));
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
    runner: (board: BoardView) =>
      // L2's deterministic mockup is the one capability that is wired: it is free, it is drawn from
      // the design version behind the board, and it stores a drawn asset (decision 0092).
      board.kind === "mockup" ? () => renderMockupBoardAction({ launchProjectId: project.id, boardId: board.id }) : null,
  });
  /** The dock's − and + move the store's view and keep the address's `zoom` in step. */
  const onZoom = (next: number): void => {
    store.zoomTo(next / 100);
    shell.commands.setZoom(next);
  };
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

  /**
   * "Write for me" against the selected board. The slot's own id goes to the server and the slot
   * itself is read there, out of the library's copy of the board's template, so a panel cannot ask
   * a model to fill anything the layout does not hold (`lib/marketing/actions.ts`).
   */
  const write = async (request: WriteRequest): Promise<WriteResult> => {
    if (selected === null) return { ok: false, reason: "Select the board you are writing for first.", ruleId: MARKETING_RULE };
    const reply = await writeMarketingCopyAction({
      launchProjectId: project.id,
      boardId: selected.id,
      slotId: request.slot.id,
      highlight: request.highlight,
      campaign: request.campaign,
    }).catch(() => null);
    if (!reply) return { ok: false, reason: WRITE_FAILED, ruleId: MARKETING_RULE };
    return reply.success ? reply.data : { ok: false, reason: reply.error.message, ruleId: MARKETING_RULE };
  };

  const services: Partial<MarketingServices> = {
    writer: write,
    voice: marketing.voice,
    pictures: drawnPictures(project),
    targets: marketing.targets,
    watermarkRules: marketing.watermarkRules,
  };

  /**
   * Every task-bar button does its own thing (decision 0133, `lib/flows/task-actions.ts`): none of
   * them only selects. The paid ones go through the flow run, so they are charged, refunded and
   * recorded like any run; a button with nothing behind it is left off the bar (`offeredBar`).
   */
  const action = (id: TaskAction) => {
    if (!selected) return;
    const step = TASK_STEPS[id];
    if (step === null) return;
    if (step.do === "remove") return shell.commands.removeBoard(selected.id);
    if (step.do === "duplicate") return shell.commands.addBoard(selected.kind, { x: selected.at.x + 40, y: selected.at.y + 40 });
    if (step.do === "remix") return shell.remix(selected.id);
    if (step.do === "add") return shell.commands.addBoard(step.kind, { x: selected.at.x + selected.size.width + 80, y: selected.at.y }, selected.id);
    if (step.do === "operation") return shell.runOperation(selected.id, step.operation, {});
    if (step.do === "download") {
      if (selected.outputFileId) window.open(boardFilePath(selected.outputFileId), "_blank", "noopener");
      return;
    }
    // Reframe: the shapes to choose from are in the board's own panel, so the board is opened.
    shell.commands.selectBoard(selected.id, false);
  };

  return (
    <MarketingServicesProvider services={services}>
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
          {/* Share · Export · Order and the open panel (E4, decision 0148). */}
          <div className="ml-auto"><ProjectActions graph={graph} garments={garments} /></div>
          <ProjectPanels graph={graph} garments={garments} unit={shell.state.unit} />
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
            {page.taskBar ? <TaskBar bar={offeredBar(page.taskBar)} busy={busy} onAdd={(kind: BoardKind) => shell.commands.addBoard(kind, { x: 0, y: 0 }, selected?.id)} onAction={action} /> : null}
            <BoardCanvas
              graph={graph}
              selectedId={shell.state.boardId}
              zoom={shell.state.zoom}
              busy={busy}
              empty={page.empty}
              commands={shell.commands}
              canvasId={project.id}
              garments={garments}
            />
            <BottomDock
              tool={shell.state.tool}
              zoom={percent}
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
              onZoom={onZoom}
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
              flow={{ costs: flowCostSource(costs), onRunAll: shell.runCanvas, graph, onOperation: shell.runOperation }}
              onUnit={shell.commands.setUnit}
              onSize={(size) => selected && shell.commands.resizeBoard(selected.id, size)}
              onColours={shell.commands.setProjectColours}
              onAddBoard={(kind) => shell.commands.addBoard(kind, { x: 0, y: 0 }, selected?.id)}
            />
          </div>
        </div>
      </div>
    </MarketingServicesProvider>
  );
}
