"use client";

import type { EditorSlotProps, SummarySection, SummarySectionId } from "@/lib/editor";
import { DesignSummary } from "./DesignSummary";
import ExportPanel from "./export/ExportPanel";
import NamesNumbers from "./names-numbers";

/**
 * The shell's right-hand panel (spec F-S4): the Design Summary, and the editor a summary row or the
 * top bar's Export button opens **in place of it**, which is what the spec means by "clicking any
 * row opens its editor in the same panel" and what `EditorCommands.openSummary` promises.
 *
 * Two of the shell's slots live here. Y5's Export panel is opened by the top bar (code review v5,
 * A11) and Y8's Names & numbers by the summary's own row (A12); the rows whose editor is one of the
 * workspace's eleven tools still open that tool in the left rail, exactly as they did. Each panel
 * carries its own heading and its own name, so the wrapper adds neither.
 */

/** What the right-hand panel is showing. */
export type SideId = "summary" | "export" | "names-numbers";

/** Which summary sections have their editor here rather than in a tool panel of the left rail. */
export const SIDE_OF_SECTION: Partial<Record<SummarySectionId, SideId>> = { "names-numbers": "names-numbers" };

type Props = Readonly<{
  side: SideId;
  sections: readonly SummarySection[];
  slot: EditorSlotProps;
  onOpenSection: (section: SummarySectionId) => void;
  onBack: () => void;
}>;

export function SidePanel({ side, sections, slot, onOpenSection, onBack }: Props) {
  if (side === "summary") return <DesignSummary sections={sections} onOpen={onOpenSection} />;
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        data-testid="side-panel-back"
        className="inline-flex min-h-10 items-center self-start rounded-md border border-border bg-bg px-3.5 text-small font-semibold text-text live:hover:bg-soft"
      >
        <span aria-hidden="true" className="mr-1">
          &#8592;
        </span>
        Back to the design summary
      </button>
      {side === "export" ? <ExportPanel {...slot} /> : <NamesNumbers {...slot} />}
    </div>
  );
}
