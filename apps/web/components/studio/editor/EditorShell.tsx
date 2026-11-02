"use client";

import { useRef, useState, type ReactNode } from "react";
import type { BaseArticle } from "@/lib/catalogue";
import type { CanvasView, EditorDraft, EditorModel, EditorSlotProps, FormValues, RailSegment, SummarySectionId } from "@/lib/editor";
import { SEGMENTS, addColourwayAction, autoDesignName, designSummary, findingLines, segmentPanelId, segmentTabId, simulateChip, simulationState, summaryTarget, validateChip } from "@/lib/editor";
import type { EditorData } from "@/lib/projects/editor-data";
import type { ValidationCheck } from "@/lib/validation/check";
import type { ToolId } from "@/lib/workspace/tools";
import type { AssistantInfo } from "../Editor";
import { DesignProblem, DroppedNotice } from "../EditorParts";
import { SaveRetry } from "../SaveRetry";
import { HISTORY_KEY, useEditor } from "../useEditor";
import { AssistantDock } from "../workspace/AssistantDock";
import type { WorkspaceSlots } from "../workspace/PanelSections";
import { ToolPanels } from "../workspace/ToolPanels";
import { ToolRail } from "../workspace/ToolRail";
import { useWorkspace } from "../workspace/useWorkspace";
import { BottomBar } from "./BottomBar";
import { CanvasFrame } from "./CanvasFrame";
import { FormToolbar } from "./FormToolbar";
import { RailSegments } from "./RailSegments";
import { RailSlotPanel } from "./RailSlots";
import { SIDE_OF_SECTION, SidePanel, type SideId } from "./SidePanel";
import { slotPropsFor } from "./slot-props";
import { TopBar } from "./TopBar";
import { useShell } from "./useShell";

export type EditorShellProps = Readonly<{
  data: EditorData;
  assistant: AssistantInfo;
  /** The older 3D trial under the drawing, still behind the server switch SHOW_3D (decision 0027). */
  show3d: boolean;
  article: BaseArticle | null;
  segment: RailSegment;
  view: CanvasView;
  beside: CanvasView | null;
  size: string;
  sizes: readonly string[];
  form: FormValues;
  draft: EditorDraft | null;
  model: EditorModel | null;
  /** What the last save's checks found (X4). Empty for a version nothing has checked. */
  checks: readonly ValidationCheck[];
  slots: WorkspaceSlots;
}>;

/* The breakout, as the existing workspace has it: from lg up the shell is wider than the page
 * column and fills the screen below the studio header, so nothing scrolls but the panels. */
const FRAME =
  "flex flex-col gap-3 pb-28 lg:-mt-6 lg:mb-[-1.5rem] lg:h-[calc(100dvh-8rem)] lg:min-h-[30rem] lg:w-[min(100vw_-_2.5rem,96rem)] lg:ml-[calc(50%_-_min(50vw_-_1.25rem,48rem))] lg:pb-0";

/*
 * The left rail is **one** column here, divided again by `LeftRail` below: its icon column, the
 * 0.75rem gap between the two and the toolbar panel, so that the segmented toggle can span the
 * whole of it. The canvas and the Design Summary keep the widths they always had --
 * 4.75 + 0.75 + 20 = 25.5rem, and 21rem of panel at xl.
 */
const COLUMNS =
  "flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[25.5rem_minmax(0,1fr)] xl:grid-cols-[26.5rem_minmax(0,1fr)_20rem]";

/**
 * The editor shell of spec F-S4: the top bar, the left rail with its Form, Library and Specs
 * toolbars, the canvas with its 2D, 3D and Tech pack views, the bottom bar and the Design
 * Summary. The Library, Specs, 2D, Tech pack, Export, Names & numbers and Repeat maker panels are
 * slots other workstreams fill (`lib/editor/slots.ts`). All seven are built, and this shell is
 * where they are mounted and given their props (`slot-props.ts`, `RailSlots.tsx`, `SidePanel.tsx`
 * and `CanvasFrame.tsx`); code review v5 A7–A12 is the record of their having been drawn nowhere.
 *
 * The existing workspace is moved in, not replaced: its rail of eleven tools, its panels, its
 * saving, undo and conflict handling and its assistant are the same code, inside the Form
 * toolbar and the right-hand column.
 */
export function EditorShell(props: EditorShellProps) {
  const { data, assistant, article, slots } = props;
  const editor = useEditor(data);
  const { state } = editor;
  const { tool, choose, layout, dispatch, root } = useWorkspace();
  const shell = useShell({ segment: props.segment, view: props.view, beside: props.beside, size: props.size, form: props.form });
  const [side, setSide] = useState<SideId>("summary");
  // The repeat maker and the inspiration board are drawn once the Library toolbar has been opened
  // and then kept: `RailSlots.tsx` says why neither belongs in every editor page view.
  const [libraryOpened, setLibraryOpened] = useState(props.segment === "library");
  // Set by a slot panel saying the 3D model no longer matches the design. Simulate clears it.
  const [modelStale, setModelStale] = useState(false);
  // The version the last undo of this session moved away from, which is what a redo restores.
  // The history itself holds no "redone" state, so a reload clears it rather than guessing.
  const [undoneFrom, setUndoneFrom] = useState<number | null>(null);
  const assistantButton = useRef<HTMLButtonElement>(null);

  // The tool is written to the address first, with `history.replaceState`, so that opening the Form
  // toolbar after it reads an address that already names the tool and does not drop it.
  const openTool = (next: ToolId) => {
    choose(next);
    if (shell.state.segment !== "form") shell.openRail("form");
  };
  const openRail = (segment: RailSegment) => {
    if (segment === "library") setLibraryOpened(true);
    shell.openRail(segment);
  };
  /**
   * `EditorCommands.openSummary`, and what a Design Summary row does: a section whose editor is a
   * slot panel opens it in the right-hand panel (Names & numbers is the one such section today);
   * the rest open their tool in the left rail, as they always have.
   */
  const openSummary = (section: SummarySectionId) => {
    const here = SIDE_OF_SECTION[section];
    if (here) return setSide(here);
    const target = summaryTarget(section);
    if (target) openTool(target.tool);
  };
  const resimulate = () => {
    setModelStale(false);
    shell.resimulate();
  };
  const closeSheet = () => {
    dispatch({ type: "closeSheet" });
    assistantButton.current?.focus();
  };

  const autoName = autoDesignName(article, shell.state.form);
  const validate = { checks: props.checks, draft: props.draft, article, form: shell.state.form };
  const simulate = simulateChip(simulationState(shell.state.form, shell.pending || modelStale ? null : shell.state.form, props.model !== null));
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
    <div ref={root} className={FRAME}>
      <TopBar
        data={data}
        version={state.version}
        busy={editor.busy}
        status={state.status}
        autoName={autoName}
        chip={validateChip(validate)}
        findings={findingLines(validate)}
        tool={tool}
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
        onExport={() => setSide(side === "export" ? "summary" : "export")}
        exportOpen={side === "export"}
      />
      <div className={COLUMNS}>
        <LeftRail
          segment={shell.state.segment}
          onSegment={openRail}
          toolRail={
            shell.state.segment === "form" ? (
              <ToolRail
                tool={tool}
                onChoose={choose}
                onAssistant={() => dispatch({ type: layout.sheetOpen ? "closeSheet" : "openSheet" })}
                assistantOpen={layout.sheetOpen}
                assistantButton={assistantButton}
              />
            ) : null
          }
          panel={
            <RailPanel
              segment={shell.state.segment}
              shell={shell}
              article={article}
              busy={editor.busy}
              context={{ data, editor, assistantAvailable: assistant.available, slots }}
              tool={tool}
              slot={slot}
              libraryOpened={libraryOpened}
            />
          }
        />
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
            <BottomBar
              colourways={data.colourways}
              colourwayId={data.colourwayId}
              onColourway={shell.setColourway}
              onNewColourway={() => editor.saveAction("colourways", addColourwayAction(data.colourways))}
              sizes={props.sizes}
              size={shell.state.size}
              onSize={shell.setSize}
              view={shell.state.view}
              beside={shell.state.beside}
              onView={shell.showView}
              simulate={simulate}
              onSimulate={resimulate}
              busy={editor.busy}
            />
          }
        />
        <div className="flex min-h-0 flex-col gap-3 lg:hidden xl:grid xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          <SidePanel side={side} sections={summary} slot={slot} onOpenSection={openSummary} onBack={() => setSide("summary")} />
          <AssistantDock
            projectId={data.projectId}
            version={data.version}
            busy={editor.busy}
            assistant={assistant}
            layout={layout}
            above={slots.organisation}
            onToggleDock={() => dispatch({ type: "toggleDock" })}
            onCloseSheet={closeSheet}
          />
        </div>
      </div>
    </div>
  );
}

type LeftRailProps = Readonly<{
  segment: RailSegment;
  onSegment: (segment: RailSegment) => void;
  /** Form's own eleven-tool rail, or nothing when another toolbar is open. */
  toolRail: ReactNode;
  panel: ReactNode;
}>;

/**
 * THE LEFT RAIL (spec F-S4): "a segmented toggle between three toolbars", and under the toggle the
 * open toolbar's panel, with the Form toolbar's own icon rail in a column beside it.
 *
 * The toggle belongs to the rail, not to that icon column, and it spans the whole width of both.
 * It was inside the icon column until now, and three words will not go in 4.75rem: the strip is
 * 8.5rem at its narrowest (three 2.5rem tabs, two 0.25rem gaps, 0.25rem of padding each side), so
 * it overflowed its column to the right, across the gap and into the panel column. The open panel
 * comes later in the document, which puts it above the overflow in the hit test, so it swallowed
 * every click meant for the third tab: Specs was on the screen, visible and enabled, and nothing
 * could press it. A person could not switch toolbars with a pointer at all (PR #150, CI run
 * 41472099701). Keep the toggle as wide as the rail and the tabs stay inside it.
 */
function LeftRail({ segment, onSegment, toolRail, panel }: LeftRailProps) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <RailSegments segment={segment} onChoose={onSegment} />
      <div className="flex min-h-0 flex-col gap-3 lg:grid lg:flex-1 lg:grid-cols-[4.75rem_minmax(0,1fr)]">
        {/* `empty:hidden` so the column adds no gap on a phone, where the tool rail is a bar
            drawn at the end of the body, and none when another toolbar has replaced Form. */}
        <div className="grid min-h-0 empty:hidden lg:grid-rows-[minmax(0,1fr)]">{toolRail}</div>
        {panel}
      </div>
    </div>
  );
}

type PanelProps = Readonly<{
  segment: RailSegment;
  shell: ReturnType<typeof useShell>;
  article: BaseArticle | null;
  busy: boolean;
  context: Parameters<typeof ToolPanels>[0]["context"];
  tool: ToolId;
  slot: EditorSlotProps;
  libraryOpened: boolean;
}>;

/**
 * The three toolbars' panels. All three are drawn and only the open one shows, so every segment's
 * `aria-controls` names a panel that really exists and a hidden panel keeps what was typed in it.
 */
function RailPanel({ segment, shell, article, busy, context, tool, slot, libraryOpened }: PanelProps) {
  return (
    <div className="grid gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]">
      <FormPanel hidden={segment !== "form"} shell={shell} article={article} busy={busy} context={context} tool={tool} />
      <RailSlotPanel segment="library" hidden={segment !== "library"} slot={slot} libraryOpened={libraryOpened} />
      <RailSlotPanel segment="specs" hidden={segment !== "specs"} slot={slot} libraryOpened={libraryOpened} />
    </div>
  );
}

type FormPanelProps = Omit<PanelProps, "segment" | "slot" | "libraryOpened"> & Readonly<{ hidden: boolean }>;

/** Form: the article's own option tiles and sliders, above the open tool's panel. */
function FormPanel({ hidden, shell, article, busy, context, tool }: FormPanelProps) {
  return (
    <div
      id={segmentPanelId("form")}
      role="tabpanel"
      aria-labelledby={segmentTabId("form")}
      hidden={hidden}
      className="grid min-h-0 gap-3 lg:row-start-1 lg:grid-rows-[auto_minmax(0,1fr)]"
    >
      {/* The tool panels come first in the markup, so Tab from the tool rail reaches the open
          panel as it always has; the article's own form is drawn above them. */}
      <div className="grid min-h-0 lg:row-start-2">
        <ToolPanels tool={tool} context={context} />
      </div>
      <section aria-label="Form toolbar" className="glass flex flex-col gap-3 overflow-y-auto rounded-3xl p-4 lg:row-start-1 lg:max-h-[38vh]">
        <p className="text-[13px] leading-relaxed text-ink-2">{SEGMENTS.form.lead}</p>
        <FormToolbar article={article} form={shell.state.form} busy={busy} onOption={shell.setOption} onParameter={shell.setParameter} />
      </section>
    </div>
  );
}
