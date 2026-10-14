"use client";

import { useRef } from "react";
import type { StoredLine } from "@/lib/projects/chat";
import type { EditorData } from "@/lib/projects/editor-data";
import { DesignProblem, DroppedNotice } from "./EditorParts";
import { SaveRetry } from "./SaveRetry";
import { HISTORY_KEY, useEditor } from "./useEditor";
import { AssistantDock } from "./workspace/AssistantDock";
import { DesignCanvas } from "./workspace/DesignCanvas";
import type { WorkspaceSlots } from "./workspace/PanelSections";
import { ToolPanels } from "./workspace/ToolPanels";
import { ToolRail } from "./workspace/ToolRail";
import { useWorkspace } from "./workspace/useWorkspace";
import { WorkspaceHeader } from "./workspace/WorkspaceHeader";

/** What the page knows about the assistant: whether a model is on, and the conversation kept so far. */
export type AssistantInfo = Readonly<{ available: boolean; conversation: readonly StoredLine[] }>;

type EditorProps = Readonly<{
  data: EditorData;
  assistant: AssistantInfo;
  /** The server switch SHOW_3D: the 3D trial under the drawing (decision 0027). */
  show3d?: boolean;
  slots: WorkspaceSlots;
}>;

/*
 * The breakout: from lg up the workspace is wider than the page column, up to 96rem, and fills
 * the screen below the studio header, so nothing scrolls but the panels themselves.
 */
const FRAME =
  "flex flex-col gap-3 pb-28 lg:-mt-6 lg:mb-[-1.5rem] lg:h-[calc(100dvh-8rem)] lg:min-h-[30rem] lg:w-[min(100vw_-_2.5rem,96rem)] lg:ml-[calc(50%_-_min(50vw_-_1.25rem,48rem))] lg:pb-0";

const columns = (dockOpen: boolean): string =>
  `flex flex-col gap-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[4.75rem_21rem_minmax(0,1fr)] ${
    dockOpen ? "xl:grid-cols-[4.75rem_22rem_minmax(0,1fr)_21rem]" : "xl:grid-cols-[4.75rem_22rem_minmax(0,1fr)_6.5rem]"
  }`;

/**
 * The one-screen design workspace: a rail of tools, the open tool's panel, the drawing in the
 * centre and the assistant docked on the right, under a header with the journey and the pinned
 * actions. Every control is the editor's own, grouped by tool; saving, conflicts and undo are
 * unchanged (useEditor). On a phone the drawing comes first, the tools are a bar along the
 * bottom and the assistant is a sheet.
 */
export function Editor({ data, assistant, show3d = false, slots }: EditorProps) {
  const editor = useEditor(data);
  const { state } = editor;
  const { tool, choose, layout, dispatch, root } = useWorkspace();
  const assistantButton = useRef<HTMLButtonElement>(null);

  const closeSheet = () => {
    dispatch({ type: "closeSheet" });
    assistantButton.current?.focus();
  };

  return (
    <div ref={root} className={FRAME}>
      <WorkspaceHeader
        data={data}
        version={state.version}
        busy={editor.busy}
        status={state.status}
        tool={tool}
        onChoose={choose}
        onUndo={editor.undo}
      />
      <div className={columns(layout.dockOpen)}>
        <ToolRail
          tool={tool}
          onChoose={choose}
          onAssistant={() => dispatch({ type: layout.sheetOpen ? "closeSheet" : "openSheet" })}
          assistantOpen={layout.sheetOpen}
          assistantButton={assistantButton}
        />
        <ToolPanels tool={tool} context={{ data, editor, assistantAvailable: assistant.available, slots }} />
        <DesignCanvas
          flat={data.flat}
          table={data.table}
          show3d={show3d}
          notices={
            <>
              <DesignProblem message={state.conflict ?? editor.errorFor(HISTORY_KEY)} conflict={state.conflict !== null} />
              <SaveRetry retry={state.retry} onRetry={editor.retry} />
              <DroppedNotice dropped={state.dropped ?? data.dropped} />
            </>
          }
        />
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
  );
}
