"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CanvasView, EditorDraft, EditorModel } from "@/lib/editor";
import { VIEWS, viewsShown } from "@/lib/editor";
import type { EditorData } from "@/lib/projects/editor-data";
import { DesignCanvas } from "../workspace/DesignCanvas";
import { SlotPlaceholder } from "./slots";
import { View3D } from "./View3D";

type Props = Readonly<{
  data: EditorData;
  view: CanvasView;
  beside: CanvasView | null;
  /** The 3D trial under the drawing, still behind the server switch SHOW_3D (decision 0027). */
  show3d: boolean;
  draft: EditorDraft | null;
  model: EditorModel | null;
  notices: ReactNode;
  bottomBar: ReactNode;
}>;

/**
 * The canvas (spec F-S4): one design, three views, on their own or side by side, with the bottom
 * bar under them. Switching views changes nothing but which of them is drawn, so the design and
 * its version are the same in all three.
 */
export function CanvasFrame({ data, view, beside, show3d, draft, model, notices, bottomBar }: Props) {
  const shown = viewsShown(view, beside);
  return (
    <section aria-label="Canvas" className="order-first flex min-h-0 flex-col overflow-hidden lg:order-none" data-testid="canvas">
      {/* Messages about the whole design, above whichever views are on the canvas. */}
      <div className="flex flex-col gap-2 pb-2 empty:hidden">{notices}</div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {shown.map((id) => (
          <div key={id} role="region" aria-label={VIEWS[id].region} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <ViewBody id={id} data={data} show3d={show3d} draft={draft} model={model} />
          </div>
        ))}
      </div>
      {bottomBar}
    </section>
  );
}

type BodyProps = Readonly<{ id: CanvasView; data: EditorData; show3d: boolean; draft: EditorDraft | null; model: EditorModel | null }>;

function ViewBody({ id, data, show3d, draft, model }: BodyProps) {
  if (id === "2d") {
    // A grid, so the drawing fills what is left and the slot keeps its own height.
    return (
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2">
        <DesignCanvas flat={data.flat} table={data.table} show3d={show3d} notices={null} />
        <SlotPlaceholder id="view-2d" />
      </div>
    );
  }
  if (id === "3d") {
    return (
      <div className="glass dot-grid flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[2rem] p-4">
        <View3D model={model} flat={data.flat} reason={draftReason(draft)} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <SlotPlaceholder id="tech-pack" />
      <Link href={`/studio/${data.projectId}/tech-pack` as Route} className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-medium text-ink">
        Open the factory file
      </Link>
    </div>
  );
}

/** Why there is no 3D model, in the drafter's own words, or nothing when there is one. */
function draftReason(draft: EditorDraft | null): string | null {
  if (!draft) return "This design is not on a base article the platform can draft yet, so it has no 3D model.";
  if (draft.kind === "not-drafted-yet") return draft.reason;
  if (draft.kind === "invalid") return "The form asks for a value this article does not offer, so nothing was drafted.";
  return null;
}
