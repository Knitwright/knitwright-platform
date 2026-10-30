"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { modelForDraft, type EditorDesign } from "@/lib/editor";
import { LOADING_LABEL } from "@/lib/garment3d/viewer";
import { flatPreview } from "@/lib/projects/flat-preview";

// three.js and the model reader are fetched only once the panel is open and there is a model.
const ModelViewer = dynamic(() => import("@/components/gltf/ModelViewer"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">{LOADING_LABEL}</p>,
});

const NO_DRAWING = "This garment has no drawing yet, so there is nothing to preview.";

/**
 * The live preview beside the export tabs (spec F-S6: "A live 3D preview sits on the left").
 *
 * It is built from the design the slot was handed and from nothing else: the drawings come from
 * `flatPreview` and the shape from the drafted panels, so the preview changes with the design and
 * the panel never fetches (the slot contract, `lib/editor/slots.ts`). A design the drafter cannot
 * draw shows its two drawings instead of a shape nobody drafted.
 */
export function Preview({ design }: Readonly<{ design: EditorDesign }>) {
  const flat = useMemo(() => flatPreview(design.spec, new Map(), undefined, null, design.colourwayId), [design.spec, design.colourwayId]);
  const model = useMemo(() => modelForDraft(design.draft), [design.draft]);
  const front = flat?.views.find((view) => view.view === "front");
  const back = flat?.views.find((view) => view.view === "back");

  if (!flat || !front || !back) {
    return (
      <p className="m-auto max-w-xs text-center text-sm leading-relaxed text-muted" data-testid="export-preview-none">
        {NO_DRAWING}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="export-preview">
      {model ? (
        <>
          <ModelViewer model={model.model} layout={model.layout} panelPictures={{}} shape={flat.shape} pictures={{ front: front.src, back: back.src }} />
          <p className="text-xs text-chalk-muted">Shape: {model.label}. It shows where the panels are, not how the garment hangs.</p>
        </>
      ) : (
        <>
          <div className="flex gap-3">
            {[front, back].map((view) => (
              // The drawing is shown as a picture, so nothing in it can run.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={view.view} src={view.src} alt={view.alt} className="w-1/2 rounded-xl bg-white p-2" />
            ))}
          </div>
          <p className="text-xs text-chalk-muted">
            {flat.notice ?? "The drawings of this version, in the colourway you are exporting."}
          </p>
        </>
      )}
    </div>
  );
}
