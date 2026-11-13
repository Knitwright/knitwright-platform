"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { CanvasStoreProvider, useCanvas, useCanvasStore } from "@/components/canvas/CanvasStore";
import { BoardContextMenu } from "@/components/editor-chrome/BoardContextMenu";
import { EditorLayout } from "@/components/editor-chrome/EditorLayout";
import { HelpFlyout, LearnFlyout, MoreFlyout } from "@/components/editor-chrome/InfoFlyouts";
import { LayersFlyout } from "@/components/editor-chrome/LayersFlyout";
import { ProductsFlyout } from "@/components/editor-chrome/ProductsFlyout";
import { ProjectPanel } from "@/components/editor-chrome/ProjectPanel";
import { PromptPill } from "@/components/editor-chrome/PromptPill";
import { RightPanel } from "@/components/editor-chrome/RightPanel";
import { useEditorInput } from "@/components/editor-chrome/useEditorInput";
import { useFlyout } from "@/components/editor-chrome/useFlyout";
import FlowRunPanel from "@/components/flows/FlowRunPanel";
import { MarketingServicesProvider, type MarketingServices } from "@/components/marketing/services";
import { CanvasDoors } from "@/components/pickers/CanvasDoors";
import { Notice } from "@/components/ui/Notice";
import { boxOf, contentBounds, zoomPercent, type GarmentPreview, type Point } from "@/lib/canvas";
import { EMPTY_SHELF, readFlyout, type ContextCommand, type Flyout, type ProductsShelf, type ZoomChoice } from "@/lib/editor-chrome";
import { boardFilePath, flowCostSource, offeredBar, TASK_STEPS } from "@/lib/flows";
import {
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
  /** The flyout the address opens with (`readFlyout`, decision 0146). Products when not given. */
  flyout?: Flyout;
  /** The Products flyout's shelves, read on the server (decision 0146). */
  products?: ProductsShelf;
}>;

const WRITE_FAILED = "Write for me could not be reached. Check your connection and try again.";

/** Where a duplicate lands: down and to the right of the board it copies. */
const NUDGE = 40;

/**
 * THE EDITOR (plan v6 E2, decision 0146; `08` §5, screen 12, prototype e01): the launch shell's
 * boards, panels and commands in the Kittl chrome -- the labelled rail and its flyouts, the canvas
 * with a floating task bar, the prompt pill and the four-group dock, and the right panel with Share,
 * Export and Order over the inspector. `EditorLayout` is the frame; this file is the wiring.
 *
 * The rail panels and each board kind's inspector are panels other workstreams fill
 * (`lib/launch/panels.ts`); E3, E4 and E5 mount theirs through `components/editor-chrome/slots.ts`
 * and `Inspector.tsx`.
 *
 * Every garment-locked rule is on the screen and not only in the code: a board with no Design board
 * behind it says so in the inspector, its Run button says there is nothing to run, and the task
 * bar's Remix is off on a picture the platform drew.
 */
export function LaunchShell(props: LaunchShellProps) {
  // The one canvas's store (decision 0145): the view and the selection, for the canvas and for
  // everything built around it.
  return (
    <CanvasStoreProvider>
      <ShellBody {...props} />
    </CanvasStoreProvider>
  );
}

function ShellBody({ project, presets, credits, costs, state, canEdit, marketing, garments = {}, flyout: opened, products = EMPTY_SHELF }: LaunchShellProps) {
  const store = useCanvasStore();
  const stage = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const percent = useCanvas((now) => zoomPercent(now.viewport));
  const hasSelection = useCanvas((now) => now.selection.length > 0);
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
  const fly = useFlyout(opened ?? readFlyout({}), shell.commands);
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
  const duplicate = (board: BoardView) => shell.commands.addBoard(board.kind, { x: board.at.x + NUDGE, y: board.at.y + NUDGE });

  const input = useEditorInput({
    boards: project.boards,
    canEdit: canEdit && !shell.busy,
    onTool: shell.commands.chooseTool,
    onSave: shell.saveVersion,
    onUndo: () => canUndo(shell.stack) && shell.commands.undo(),
    onRedo: () => canRedo(shell.stack) && shell.commands.redo(),
    onDuplicate: duplicate,
    onRemove: (board) => shell.commands.removeBoard(board.id),
    onZoomed: shell.commands.setZoom,
  });

  const command = (id: MenuCommand) => {
    // Save keeps the canvas as a version; Duplicate copies the selected board, or adds a fresh
    // artboard when nothing is selected. Settings is handled inside the menu itself.
    if (id === "save") return shell.saveVersion();
    if (id === "duplicate") return selected ? duplicate(selected) : shell.commands.addBoard("artboard", { x: 0, y: 0 });
    return undefined;
  };

  /**
   * What a panel another workstream built is given, and all it is given: the project as read-only
   * facts and the commands it may ask for (`lib/launch/panels.ts`). `openPanel` moves the flyout as
   * well as the shell, so a panel that opens another panel opens it where a person can see it.
   */
  const panel: LaunchPanelProps = {
    context: { project, selection: page.selection, credits, presets, unit: shell.state.unit, zoom: shell.state.zoom, dockTool: shell.state.tool, busy },
    commands: { ...shell.commands, openPanel: fly.openPanel },
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
    if (step.do === "duplicate") return duplicate(selected);
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

  /** The context menu's rows, each to the command that already does it. */
  const onContext = (board: BoardView, id: ContextCommand) => {
    if (id === "duplicate") return duplicate(board);
    if (id === "remove") return shell.commands.removeBoard(board.id);
    if (id === "fit-selection") return store.fit(boxOf(board));
    if (id === "add-artboard") return shell.commands.addBoard("artboard", { x: board.at.x + boxOf(board).width + 80, y: board.at.y });
    if (id === "download" && board.outputFileId) return void window.open(boardFilePath(board.outputFileId), "_blank", "noopener");
    if (id === "open-editor") router.push(`/project/${project.id}?focus=${board.id}` as Route);
  };

  const onZoomChoice = (choice: ZoomChoice) => {
    if (choice.kind === "fit-content") store.fit(contentBounds(project.boards));
    else if (choice.kind === "fit-selection") store.fit(contentBounds(project.boards.filter((one) => store.getState().selection.includes(one.id))));
    else store.zoomTo(choice.scale);
    shell.commands.setZoom(zoomPercent(store.getState().viewport));
  };

  const ownFlyout = (): ReactNode => {
    if (fly.flyout.kind !== "own") return null;
    switch (fly.flyout.id) {
      case "products":
        return <ProductsFlyout shelf={products} canEdit={canEdit} busy={busy} onPlace={(id, name) => shell.placeGarment(id, name, placeAfter(project.boards))} />;
      case "more":
        return <MoreFlyout onOpen={fly.show} />;
      case "learn":
        return <LearnFlyout onOpen={fly.show} />;
      case "layers":
        return <LayersFlyout panel={panel} />;
      case "help":
        return <HelpFlyout />;
    }
  };

  const menuBoard = input.menu ? (project.boards.find((one) => one.id === input.menu?.boardId) ?? null) : null;
  const flow = { costs: flowCostSource(costs), onRunAll: shell.runCanvas, graph, onOperation: shell.runOperation };

  return (
    <MarketingServicesProvider services={services}>
      <EditorLayout
        stage={stage}
        onFocus={input.onFocus}
        onContextMenu={input.onContextMenu}
        onKeyDown={input.onKeyDown}
        rail={
          <IconRail
            flyout={fly.flyout}
            labels={fly.labels}
            onPress={fly.press}
            menu={<MainMenu projectId={project.id} unit={shell.state.unit} busy={busy} labels={fly.labels} onUnit={shell.commands.setUnit} onLabels={fly.setLabels} onCommand={command} />}
          />
        }
        flyout={<RailPanels flyout={fly.flyout} panel={panel} own={ownFlyout()} onClose={fly.close} onBack={() => fly.show({ kind: "own", id: "more" })} />}
        notices={
          <>
            {canEdit ? null : <Notice tone="info">You can look at this project. Only owners, admins and kit managers can change it.</Notice>}
            {shell.note ? (
              <div data-testid="launch-note">
                <Notice tone={shell.note.tone} role={shell.note.tone === "warn" ? "alert" : "status"}>
                  {shell.note.text}
                </Notice>
              </div>
            ) : null}
          </>
        }
        canvas={
          <BoardCanvas graph={graph} selectedId={shell.state.boardId} zoom={shell.state.zoom} busy={busy} empty={page.empty} commands={shell.commands} canvasId={project.id} garments={garments} />
        }
        taskBar={
          page.taskBar && selected ? (
            <TaskBar
              bar={offeredBar(page.taskBar)}
              busy={busy}
              box={boxOf(selected)}
              stage={stage}
              onAdd={(kind: BoardKind) => shell.commands.addBoard(kind, { x: selected.at.x + selected.size.width + 80, y: selected.at.y }, selected.id)}
              onAction={action}
              onMenu={(at: Point) => input.open(selected.id, at)}
            />
          ) : null
        }
        prompt={
          <PromptPill
            bar={{ project, credits, costs, canEdit }}
            busy={busy}
            runLabel={estimate ? runLabel(estimate) : null}
            canRun={canRun && !busy}
            note={estimate && estimate.credits > 0 ? estimate.note : null}
            onRun={() => selected && shell.commands.requestRun(selected.id)}
          />
        }
        dock={
          <BottomDock
            tool={shell.state.tool}
            zoom={percent}
            credits={credits}
            canUndo={canUndo(shell.stack)}
            canRedo={canRedo(shell.stack)}
            busy={busy}
            hasSelection={hasSelection}
            onTool={shell.commands.chooseTool}
            onZoomStep={(direction) => {
              store.zoomStep(direction);
              shell.commands.setZoom(zoomPercent(store.getState().viewport));
            }}
            onZoomChoice={onZoomChoice}
            onUndo={shell.commands.undo}
            onRedo={shell.commands.redo}
          />
        }
        right={
          <RightPanel
            projectName={project.name}
            panel={panel}
            doors={<CanvasDoors project={project} presets={presets} canEdit={canEdit} selectedId={shell.state.boardId} />}
          >
            {page.selection === null ? (
              <ProjectPanel
                colours={project.colours}
                busy={busy}
                onColours={shell.commands.setProjectColours}
                onAddBoard={(kind) => shell.commands.addBoard(kind, { x: 0, y: 0 })}
                onBrowsePalettes={() => fly.show({ kind: "panel", id: "brand" })}
                runSummary={project.boards.length === 0 ? null : <FlowRunPanel {...panel} costs={flow.costs} onRunAll={flow.onRunAll} />}
              />
            ) : (
              <div className="flex min-h-0 flex-col p-3">
                <Inspector
                  projectName={project.name}
                  colours={project.colours}
                  selection={page.selection}
                  unit={shell.state.unit}
                  presets={presets}
                  busy={busy}
                  lockNote={page.lockNote}
                  panel={panel}
                  flow={flow}
                  onUnit={shell.commands.setUnit}
                  onSize={(size) => selected && shell.commands.resizeBoard(selected.id, size)}
                  onColours={shell.commands.setProjectColours}
                  onAddBoard={(kind) => shell.commands.addBoard(kind, { x: 0, y: 0 }, selected?.id)}
                />
              </div>
            )}
          </RightPanel>
        }
      />
      {input.menu && menuBoard ? (
        <BoardContextMenu board={menuBoard} at={input.menu.at} canEdit={canEdit && !shell.busy} onCommand={(id) => onContext(menuBoard, id)} onClose={() => input.setMenu(null)} />
      ) : null}
    </MarketingServicesProvider>
  );
}

/** A new garment board goes to the right of everything on the canvas, so it never covers a board. */
const placeAfter = (boards: readonly BoardView[]): Point => {
  const bounds = contentBounds(boards);
  return bounds === null ? { x: 0, y: 0 } : { x: bounds.x + bounds.width + 120, y: bounds.y };
};
