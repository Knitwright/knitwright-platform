"use client";

import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import type { EditorShellProps } from "@/components/studio/editor/shell-props";
import { CanvasFrame } from "@/components/studio/editor/CanvasFrame";
import { SIDE_OF_SECTION, SidePanel, type SideId } from "@/components/studio/editor/SidePanel";
import { slotPropsFor } from "@/components/studio/editor/slot-props";
import { useShell } from "@/components/studio/editor/useShell";
import { DesignProblem, DroppedNotice } from "@/components/studio/EditorParts";
import { SaveRetry } from "@/components/studio/SaveRetry";
import { HISTORY_KEY, useEditor } from "@/components/studio/useEditor";
import { AssistantDock } from "@/components/studio/workspace/AssistantDock";
import { useMedia, XL } from "@/components/studio/workspace/useMedia";
import { useWorkspace } from "@/components/studio/workspace/useWorkspace";
import type { RailSegment, SummarySectionId } from "@/lib/editor";
import { addColourwayAction, autoDesignName, designSummary, findingLines, simulateChip, simulationState, summaryTarget, validateChip } from "@/lib/editor";
import { fitChip } from "@/lib/garment-studio/fit";
import type { ClubLibrary } from "@/lib/garment-studio/library";
import { withShelf, type ShelfId } from "@/lib/garment-studio/shelves";
import type { ToolId } from "@/lib/workspace/tools";
import { LibraryColumn } from "./LibraryColumn";
import { ShelfPanel } from "./ShelfPanel";
import { StageBar, StageTop } from "./StageControls";
import { StudioExport } from "./StudioExport";
import { StudioTopBar } from "./StudioTopBar";
import { ToolbarPanels } from "./ToolbarPanels";
import { WelcomeModal } from "./WelcomeModal";

export type GarmentStudioProps = EditorShellProps &
  Readonly<{
    backHref: Route;
    canvasName: string;
    credits: number | null;
    club: ClubLibrary;
    shelf: ShelfId | null;
    /** The /dev fixture opens the welcome whatever the browser remembers. */
    welcome?: boolean;
  }>;

/* The whole window, below the dashboard's own top bar, which the editor chrome hides (decision 0146).
 * `--shell-vw` is the window's width on a canvas page, so the studio leaves the page column. */
const FRAME =
  "flex w-full flex-col bg-bg pb-28 lg:ml-[calc(50%-var(--shell-vw,100vw)/2)] lg:h-dvh lg:w-(--shell-vw) lg:overflow-hidden lg:pb-0";

/* `10` §4: library 236 · panel 380 · stage · summary 360. The summary joins from xl, as before. */
const COLUMNS =
  "flex flex-col lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[14.75rem_23.75rem_minmax(0,1fr)] xl:grid-cols-[14.75rem_23.75rem_minmax(0,1fr)_22.5rem]";

/**
 * GARMENT STUDIO (plan v6 G1, decision 0150; `08` v3.6, `09` screen 27): the focused-garment mode of
 * the canvas, `/project/<id>?focus=<board>`. The top bar; the library column; the open library panel
 * or toolbar; the grey stage with 2D / 3D / Tech pack, the colourway and size pills and Fit checked;
 * and the Design summary, with Names & numbers and the full Export panel opening in its place.
 *
 * It is the editor shell of spec F-S4 (decision 0075) laid out again, not a second editor: the same
 * saving, undo, conflict handling, address state and slot panels. What the editor had and the studio
 * has no place for on screen is in the File menu.
 */
export function GarmentStudio(props: GarmentStudioProps) {
  const { data, assistant, article, slots } = props;
  const editor = useEditor(data);
  const { state } = editor;
  const { tool, choose, layout, dispatch, root } = useWorkspace();
  const shell = useShell({ segment: props.segment, view: props.view, beside: props.beside, size: props.size, form: props.form });
  const wide = useMedia(XL);
  const [side, setSide] = useState<SideId>("summary");
  const [shelf, setShelf] = useState<ShelfId | null>(props.shelf);
  const [exportOpen, setExportOpen] = useState(false);
  const [libraryOpened, setLibraryOpened] = useState(props.segment === "library");
  const [modelStale, setModelStale] = useState(false);
  const [undoneFrom, setUndoneFrom] = useState<number | null>(null);
  const assistantButton = useRef<HTMLButtonElement>(null);
  const lastTool = useRef(tool);

  const showShelf = (next: ShelfId | null) => {
    setShelf(next);
    window.history.replaceState(null, "", `${window.location.pathname}${withShelf(window.location.search, next)}${window.location.hash}`);
  };
  // A tool opened from anywhere -- a summary row, a field asking for focus, a link -- is a Form panel,
  // which a library panel would cover.
  useEffect(() => {
    if (lastTool.current === tool) return;
    lastTool.current = tool;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (shelf !== null) showShelf(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const openRail = (segment: RailSegment) => {
    if (segment === "library") setLibraryOpened(true);
    if (shelf !== null) showShelf(null);
    shell.openRail(segment);
  };
  const openTool = (next: ToolId) => {
    choose(next);
    if (shell.state.segment !== "form" || shelf !== null) openRail("form");
  };
  const openSummary = (section: SummarySectionId) => {
    const here = SIDE_OF_SECTION[section];
    if (here) return setSide(here);
    const target = summaryTarget(section);
    if (target) openTool(target.tool);
  };
  const toggleAssistant = () => dispatch({ type: wide ? "toggleDock" : layout.sheetOpen ? "closeSheet" : "openSheet" });

  const validate = { checks: props.checks, draft: props.draft, article, form: shell.state.form };
  const simulation = simulationState(shell.state.form, shell.pending || modelStale ? null : shell.state.form, props.model !== null);
  const summary = designSummary({ spec: editor.working, article, form: shell.state.form, colours: data.colours, artwork: data.artwork, namesNumbers: data.namesNumbers });
  const slot = slotPropsFor({
    shell,
    projectId: data.projectId,
    version: state.version,
    spec: editor.working,
    article,
    sizes: props.sizes,
    colourwayId: data.colourwayId,
    draft: props.draft,
    busy: editor.busy,
    save: editor.saveAction,
    openRail,
    openSummary,
    needsSimulation: () => setModelStale(true),
  });

  return (
    <div ref={root} className={FRAME} data-editor-chrome="" data-testid="garment-studio">
      <StudioTopBar
        data={data}
        version={state.version}
        busy={editor.busy}
        status={state.status}
        autoName={autoDesignName(article, shell.state.form)}
        backHref={props.backHref}
        canvasName={props.canvasName}
        credits={props.credits}
        canUndo={data.undoTo !== null}
        canRedo={undoneFrom !== null}
        onUndo={() => {
          setUndoneFrom(state.version);
          editor.undo();
        }}
        onRedo={() => {
          if (undoneFrom === null) return;
          editor.restore(undoneFrom);
          setUndoneFrom(null);
        }}
        onTool={openTool}
        onExport={() => setExportOpen(!exportOpen)}
        exportOpen={exportOpen}
      />
      <div className={COLUMNS}>
        <LibraryColumn
          projectId={data.projectId}
          clubName={props.club.name}
          shelf={shelf}
          onShelf={showShelf}
          segment={shelf === null ? shell.state.segment : null}
          onSegment={openRail}
          onAssistant={toggleAssistant}
          assistantOpen={wide ? layout.dockOpen : layout.sheetOpen}
        />
        {shelf === null ? null : <ShelfPanel shelf={shelf} slot={slot} club={props.club} onTool={openTool} onClose={() => showShelf(null)} />}
        <ToolbarPanels
          segment={shelf === null ? shell.state.segment : null}
          slot={slot}
          libraryOpened={libraryOpened}
          article={article}
          form={shell.state.form}
          busy={editor.busy}
          onOption={shell.setOption}
          onParameter={shell.setParameter}
          tool={tool}
          onTool={choose}
          context={{ data, editor, assistantAvailable: assistant.available, slots }}
          onAssistant={toggleAssistant}
          assistantOpen={layout.sheetOpen}
          assistantButton={assistantButton}
        />
        {/* Grey for the 3D stage (s02); the drawing and the tech pack keep the light canvas their text was set on. */}
        <div className={`relative order-first flex min-h-[80dvh] flex-col lg:order-none lg:min-h-0 ${shell.state.view === "3d" && shell.state.beside === null ? "bg-stage" : "bg-soft-2"}`} data-testid="studio-stage">
          <div className="flex justify-end p-4 pb-0">
            <StageTop
              fit={fitChip(validateChip(validate), simulation)}
              findings={findingLines(validate)}
              simulate={simulateChip(simulation)}
              onSimulate={() => {
                setModelStale(false);
                shell.resimulate();
              }}
              onPhotoreal={() => openTool("photoreal")}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-4 [&>section]:flex-1">
            <CanvasFrame
              data={data}
              view={shell.state.view}
              beside={shell.state.beside}
              show3d={props.show3d}
              draft={props.draft}
              model={props.model}
              slot={slot}
              notices={
                <>
                  <DesignProblem message={state.conflict ?? editor.errorFor(HISTORY_KEY)} conflict={state.conflict !== null} />
                  <SaveRetry retry={state.retry} onRetry={editor.retry} />
                  <DroppedNotice dropped={state.dropped ?? data.dropped} />
                </>
              }
              bottomBar={
                <StageBar
                  colourways={data.colourways.map((choice) => ({ id: choice.id, label: choice.name, swatch: swatchOf(data.spec, choice.id) }))}
                  colourwayId={data.colourwayId}
                  onColourway={shell.setColourway}
                  onNewColourway={() => editor.saveAction("colourways", addColourwayAction(data.colourways))}
                  sizes={props.sizes}
                  size={shell.state.size}
                  onSize={shell.setSize}
                  view={shell.state.view}
                  beside={shell.state.beside}
                  onView={shell.showView}
                  busy={editor.busy}
                />
              }
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 border-border bg-bg p-4 lg:hidden xl:grid xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:border-l">
          <SidePanel side={side} sections={summary} slot={slot} onOpenSection={openSummary} onBack={() => setSide("summary")} />
          <AssistantDock
            projectId={data.projectId}
            version={data.version}
            busy={editor.busy}
            assistant={assistant}
            layout={layout}
            above={slots.organisation}
            onToggleDock={() => dispatch({ type: "toggleDock" })}
            onCloseSheet={() => {
              dispatch({ type: "closeSheet" });
              assistantButton.current?.focus();
            }}
          />
        </div>
      </div>
      {exportOpen ? (
        <div className="fixed top-18 right-4 z-50">
          <StudioExport
            design={slot.design}
            onClose={() => setExportOpen(false)}
            onAllFiles={() => {
              setExportOpen(false);
              setSide("export");
            }}
          />
        </div>
      ) : null}
      <WelcomeModal forceOpen={props.welcome} />
    </div>
  );
}

/** The first screen colour of a colourway, for the dot beside its name in the menu; null when it has none. */
function swatchOf(spec: EditorShellProps["data"]["spec"], colourwayId: string): string | null {
  return spec.colourways.find((way) => way.id === colourwayId)?.colours.find((entry) => entry.swatch !== undefined)?.swatch ?? null;
}
