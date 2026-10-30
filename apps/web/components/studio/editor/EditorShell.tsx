"use client";

import { useRef, useState } from "react";
import type { BaseArticle } from "@/lib/catalogue";
import type { CanvasView, EditorDraft, EditorModel, FormValues, RailSegment } from "@/lib/editor";
import { SEGMENTS, addColourwayAction, autoDesignName, designSummary, findingLines, segmentPanelId, segmentTabId, simulateChip, simulationState, validateChip } from "@/lib/editor";
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
import { DesignSummary } from "./DesignSummary";
import { FormToolbar } from "./FormToolbar";
import { RailSegments } from "./RailSegments";
import { SlotPlaceholder } from "./slots";
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

const COLUMNS =
  "flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.75rem_20rem_minmax(0,1fr)] xl:grid-cols-[4.75rem_21rem_minmax(0,1fr)_20rem]";

/**
 * The editor shell of spec F-S4: the top bar, the left rail with its Form, Library and Specs
 * toolbars, the canvas with its 2D, 3D and Tech pack views, the bottom bar and the Design
 * Summary. The Library, Specs, 2D, Tech pack and Export panels are slots other workstreams fill
 * (`lib/editor/slots.ts`); until they land the shell draws a labelled placeholder for each.
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
  const [exportOpen, setExportOpen] = useState(false);
  const assistantButton = useRef<HTMLButtonElement>(null);

  const openTool = (next: ToolId) => {
    if (shell.state.segment !== "form") shell.openRail("form");
    choose(next);
  };
  const closeSheet = () => {
    dispatch({ type: "closeSheet" });
    assistantButton.current?.focus();
  };

  const autoName = autoDesignName(article, shell.state.form);
  const validate = { checks: props.checks, draft: props.draft, article, form: shell.state.form };
  const simulate = simulateChip(simulationState(shell.state.form, shell.pending ? null : shell.state.form, props.model !== null));
  const summary = designSummary({ spec: editor.working, article, form: shell.state.form, colours: data.colours, artwork: data.artwork, namesNumbers: data.namesNumbers });

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
        onUndo={editor.undo}
        onTool={openTool}
        onExport={() => setExportOpen(!exportOpen)}
        exportOpen={exportOpen}
      />
      <div className={COLUMNS}>
        <div className="grid gap-2 lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
          <RailSegments segment={shell.state.segment} onChoose={shell.openRail} />
          {shell.state.segment === "form" ? (
            <ToolRail
              tool={tool}
              onChoose={choose}
              onAssistant={() => dispatch({ type: layout.sheetOpen ? "closeSheet" : "openSheet" })}
              assistantOpen={layout.sheetOpen}
              assistantButton={assistantButton}
            />
          ) : null}
        </div>
        <RailPanel segment={shell.state.segment} shell={shell} article={article} busy={editor.busy} context={{ data, editor, assistantAvailable: assistant.available, slots }} tool={tool} />
        <CanvasFrame
          data={data}
          view={shell.state.view}
          beside={shell.state.beside}
          show3d={props.show3d}
          draft={props.draft}
          model={props.model}
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
              onSimulate={shell.resimulate}
              busy={editor.busy}
            />
          }
        />
        <div className="flex min-h-0 flex-col gap-3 lg:hidden xl:grid xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          {exportOpen ? <SlotPlaceholder id="export" /> : <DesignSummary sections={summary} onOpen={openTool} />}
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

type PanelProps = Readonly<{
  segment: RailSegment;
  shell: ReturnType<typeof useShell>;
  article: BaseArticle | null;
  busy: boolean;
  context: Parameters<typeof ToolPanels>[0]["context"];
  tool: ToolId;
}>;

/**
 * The three toolbars' panels. All three are drawn and only the open one shows, so every segment's
 * `aria-controls` names a panel that really exists and a hidden panel keeps what was typed in it.
 */
function RailPanel({ segment, shell, article, busy, context, tool }: PanelProps) {
  return (
    <div className="grid gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]">
      <FormPanel hidden={segment !== "form"} shell={shell} article={article} busy={busy} context={context} tool={tool} />
      <SlotPanel segment="library" hidden={segment !== "library"} />
      <SlotPanel segment="specs" hidden={segment !== "specs"} />
    </div>
  );
}

/** Library and Specs: the heading and lead of the toolbar, and the slot its workstream fills. */
function SlotPanel({ segment, hidden }: Readonly<{ segment: Exclude<RailSegment, "form">; hidden: boolean }>) {
  return (
    <div
      id={segmentPanelId(segment)}
      role="tabpanel"
      aria-labelledby={segmentTabId(segment)}
      hidden={hidden}
      className="glass flex min-h-0 flex-col gap-3 overflow-y-auto rounded-3xl p-4"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{SEGMENTS[segment].title}</h2>
        <p className="text-[13px] leading-relaxed text-chalk-muted">{SEGMENTS[segment].lead}</p>
      </header>
      <SlotPlaceholder id={segment} />
    </div>
  );
}

type FormPanelProps = Omit<PanelProps, "segment"> & Readonly<{ hidden: boolean }>;

/** Form: the article's own option tiles and sliders, above the open tool's panel. */
function FormPanel({ hidden, shell, article, busy, context, tool }: FormPanelProps) {
  return (
    <div id={segmentPanelId("form")} role="tabpanel" aria-labelledby={segmentTabId("form")} hidden={hidden} className="grid min-h-0 gap-3 lg:grid-rows-[auto_minmax(0,1fr)]">
      {/* The tool panels come first in the markup, so Tab from the tool rail reaches the open
          panel as it always has; the article's own form is drawn above them. */}
      <div className="grid min-h-0 lg:row-start-2">
        <ToolPanels tool={tool} context={context} />
      </div>
      <section aria-label="Form toolbar" className="glass flex flex-col gap-3 overflow-y-auto rounded-3xl p-4 lg:row-start-1 lg:max-h-[38vh]">
        <p className="text-[13px] leading-relaxed text-chalk-muted">{SEGMENTS.form.lead}</p>
        <FormToolbar article={article} form={shell.state.form} busy={busy} onOption={shell.setOption} onParameter={shell.setParameter} />
      </section>
    </div>
  );
}
