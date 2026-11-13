"use client";

import type { Ref } from "react";
import { FormToolbar } from "@/components/studio/editor/FormToolbar";
import { RailSlotPanel } from "@/components/studio/editor/RailSlots";
import { ToolPanels } from "@/components/studio/workspace/ToolPanels";
import { ToolRail } from "@/components/studio/workspace/ToolRail";
import type { BaseArticle } from "@/lib/catalogue";
import type { EditorSlotProps, FormValues, RailSegment } from "@/lib/editor";
import { SEGMENTS, segmentPanelId, segmentTabId } from "@/lib/editor";
import type { ToolId } from "@/lib/workspace/tools";

type Props = Readonly<{
  /** The open toolbar, or null while a library panel is open in its place. */
  segment: RailSegment | null;
  slot: EditorSlotProps;
  libraryOpened: boolean;
  article: BaseArticle | null;
  form: FormValues;
  busy: boolean;
  onOption: (group: string, code: string) => void;
  onParameter: (key: string, mm: number) => void;
  tool: ToolId;
  onTool: (tool: ToolId) => void;
  context: Parameters<typeof ToolPanels>[0]["context"];
  onAssistant: () => void;
  assistantOpen: boolean;
  assistantButton: Ref<HTMLButtonElement>;
}>;

/**
 * THE EDITOR'S THREE TOOLBARS, IN THE STUDIO'S 380 px PANEL (plan v6 G1, decision 0150).
 *
 * Every control the editor had is here, moved and not lost: Form (the article's own options and
 * ranges, then the workspace's eleven tools and their panels), Library (Y3's toolbar, the repeat
 * maker and the inspiration board) and Specs (Y4's toolbar and the Ask box). All three are drawn and
 * only the open one shows, so every tab's `aria-controls` names a panel that exists and a hidden
 * panel keeps what was typed in it. While a library panel is open, all three are hidden.
 */
export function ToolbarPanels(props: Props) {
  const { segment, slot, libraryOpened } = props;
  return (
    <div className="flex min-h-0 flex-col border-border bg-bg lg:border-r" data-testid="studio-toolbar-panels" hidden={segment === null}>
      <FormPanel {...props} hidden={segment !== "form"} />
      <RailSlotPanel segment="library" hidden={segment !== "library"} slot={slot} libraryOpened={libraryOpened} />
      <RailSlotPanel segment="specs" hidden={segment !== "specs"} slot={slot} libraryOpened={libraryOpened} />
    </div>
  );
}

/**
 * Form: the tools as a row of chips, the article's own option tiles and sliders, then the open tool's
 * panel. The tool rail is drawn only while Form is open: on a phone it is a bar fixed to the foot of
 * the screen, outside any hidden parent.
 */
function FormPanel(props: Props & Readonly<{ hidden: boolean }>) {
  return (
    <div
      id={segmentPanelId("form")}
      role="tabpanel"
      aria-labelledby={segmentTabId("form")}
      hidden={props.hidden}
      className="flex min-h-0 flex-1 flex-col gap-3 p-4 lg:grid lg:grid-rows-[auto_auto_minmax(0,1fr)]"
    >
      {props.hidden ? null : (
        <ToolRail tool={props.tool} onChoose={props.onTool} onAssistant={props.onAssistant} assistantOpen={props.assistantOpen} assistantButton={props.assistantButton} compact />
      )}
      {/* The tool panels come before the form in the markup, so Tab from the tool chips reaches the
          open panel as it always has; the article's own form is drawn above them. */}
      <div className="grid min-h-0 lg:row-start-3">
        <ToolPanels tool={props.tool} context={props.context} />
      </div>
      <section aria-label="Form toolbar" className="flex flex-col gap-3 overflow-y-auto rounded-xl bg-soft p-3.5 lg:row-start-2 lg:max-h-[30vh]">
        <p className="text-small text-muted">{SEGMENTS.form.lead}</p>
        <FormToolbar article={props.article} form={props.form} busy={props.busy} onOption={props.onOption} onParameter={props.onParameter} />
      </section>
    </div>
  );
}
