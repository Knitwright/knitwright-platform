"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EditorModel } from "@/lib/editor";
import { LOADING_LABEL } from "@/lib/garment3d/viewer";
import type { FlatPreviewData } from "@/lib/projects/flat-preview";

// three.js and the model reader are fetched only when the 3D view is on the canvas.
const ModelViewer = dynamic(() => import("@/components/gltf/ModelViewer"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">{LOADING_LABEL}</p>,
});

type Props = Readonly<{
  /** The placeholder model built from the drafted panels, or null when the article has no draft. */
  model: EditorModel | null;
  flat: FlatPreviewData | null;
  /** Why there is no model, in the drafter's own words. */
  reason: string | null;
}>;

const NO_PICTURES = "The 3D view needs the design's drawing, and this garment has none yet.";

/**
 * The 3D view of the canvas (spec F-S4). It shows the base article's model on the drafted panels,
 * through the viewer `lib/gltf` already has. Until artist models exist that model is the
 * placeholder generator's, and the label beside the view says so at all times.
 *
 * There is no `SHOW_3D` switch here: for a base article the drafter can draw, 3D is simply on
 * (decision 0075). The older trial under the drawing is unchanged and still behind that switch.
 */
export function View3D({ model, flat, reason }: Props) {
  const front = flat?.views.find((view) => view.view === "front")?.src;
  const back = flat?.views.find((view) => view.view === "back")?.src;
  const pictures = useMemo(() => (front && back ? { front, back } : null), [front, back]);

  if (!model) {
    return (
      <p className="m-auto max-w-sm text-center text-sm leading-relaxed text-muted" data-testid="view-3d-none">
        {reason ?? "This article has no 3D model yet."}
      </p>
    );
  }
  if (!flat || !pictures) {
    return (
      <p className="m-auto max-w-sm text-center text-sm leading-relaxed text-muted" data-testid="view-3d-none">
        {NO_PICTURES}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="view-3d">
      <p className="text-xs text-chalk-muted">
        Shape: {model.label}. It shows where the panels are, not how the garment hangs.
      </p>
      <ModelViewer model={model.model} layout={model.layout} panelPictures={{}} shape={flat.shape} pictures={pictures} />
    </div>
  );
}
