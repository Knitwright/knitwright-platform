"use client";

import { useId } from "react";
import type { LaunchPanelProps } from "@/lib/launch";
import { GOLDEN_SAMPLE_LEAD, NO_PHOTOS_BODY, NO_PHOTOS_TITLE, OPEN_UPLOADS, PHOTOS_GAP, PHOTOS_PANEL_LEAD, PHOTOS_PANEL_TITLE } from "@/lib/mockups";
import { alertProps, panelProps } from "./a11y";

/**
 * THE PHOTOS PANEL of the rail (spec Launch shell: "Photos").
 *
 * It holds two kinds of picture a mockup may start from: the brand's own photographs, and the
 * photographs of a **golden sample** of this design -- which is the one picture of the garment that
 * is not drawn and is still allowed, because somebody signed the sample off (plan v5 wave 4
 * preamble).
 *
 * **It shows neither yet, and it says so rather than showing an empty grid.** The panel contract
 * gives a panel the project and the selection, not the brand's files (`lib/launch/panels.ts`): the
 * uploads are L7's and a golden sample is F-S7's. So the panel does the one thing it honestly can --
 * name both doors and open the one that is inside this shell -- and carries `PHOTOS_GAP` with its
 * rule.
 */
export default function PhotosPanel({ context, commands }: LaunchPanelProps) {
  const headingId = useId();
  return (
    <section {...panelProps(headingId, context.busy)} className="flex min-h-0 flex-col gap-3" data-testid="photos-panel">
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-[15px] font-medium text-ink">
          {PHOTOS_PANEL_TITLE}
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{PHOTOS_PANEL_LEAD}</p>
      </header>

      <div data-testid="photos-empty" className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/20 p-4">
        <h3 className="text-[14px] font-medium text-ink">{NO_PHOTOS_TITLE}</h3>
        <p className="text-[13px] leading-relaxed text-ink-2">{NO_PHOTOS_BODY}</p>
        <button
          type="button"
          disabled={context.busy}
          onClick={() => commands.openPanel("uploads")}
          data-testid="photos-open-uploads"
          className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-[13px] font-medium text-ink"
        >
          {OPEN_UPLOADS}
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-2">{GOLDEN_SAMPLE_LEAD}</p>

      <p {...alertProps()} data-testid="photos-gap" className="text-[12px] leading-relaxed text-ink-2">
        {PHOTOS_GAP.line} <span className="font-mono">{PHOTOS_GAP.ruleId}</span>
      </p>
    </section>
  );
}
