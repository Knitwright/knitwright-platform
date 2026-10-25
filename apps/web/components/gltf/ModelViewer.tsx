"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import GarmentViewer, { type GarmentViewerProps } from "@/components/garment3d/GarmentViewer";
import { FAILED_LABEL, HELP_LABEL, motionFor } from "@/lib/garment3d/viewer";
import { atlasPlan, chooseViewer, PRESET_VIEWS, SIZE_LABEL, type GltfModel, type PanelLayout, type PresetView } from "@/lib/gltf";
import { mountModel, parseModel, type ModelScene } from "./scene";

export interface ModelViewerProps extends GarmentViewerProps {
  /** The base model for the article, or null when there is none: the viewer then shows the form made from the flat. */
  readonly model: GltfModel | null;
  readonly layout: PanelLayout | null;
  /** The picture address of each panel render, by panel id. These are the renders the print files are made from. */
  readonly panelPictures: Readonly<Record<string, string>>;
}

const VIEW_LABELS: Readonly<Record<PresetView, string>> = { front: "Front", back: "Back", left: "Left", right: "Right", top: "Top" };

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A panel picture could not be loaded."));
    image.src = src;
  });
}

/** Draws every panel render into the rectangle of its island in the one picture. */
async function paintAtlas(layout: PanelLayout, pictures: Readonly<Record<string, string>>): Promise<HTMLCanvasElement> {
  const plan = atlasPlan(layout, Object.keys(pictures));
  const canvas = document.createElement("canvas");
  canvas.width = plan.size;
  canvas.height = plan.size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, plan.size, plan.size);
  const images = await Promise.all(plan.draws.map((d) => load(pictures[d.panelId] as string)));
  plan.draws.forEach((d, i) => context.drawImage(images[i] as HTMLImageElement, d.x, d.y, d.width, d.height));
  return canvas;
}

function GltfView({ model, layout, panelPictures }: { model: GltfModel; layout: PanelLayout | null; panelPictures: Readonly<Record<string, string>> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ModelScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    Promise.all([parseModel(model), layout ? paintAtlas(layout, panelPictures) : Promise.resolve(null)])
      .then(([root, atlas]) => {
        if (!cancelled) scene.current = mountModel(target, root, atlas, motionFor(reduced));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [model, layout, panelPictures]);

  return (
    <div data-testid="gltf-3d">
      <p className="mb-2 text-sm font-medium text-ink" data-testid="gltf-3d-label">
        {SIZE_LABEL}
      </p>
      {model.asset.extras?.knitwright.placeholder ? (
        <p className="mb-2 text-sm text-muted" data-testid="gltf-3d-placeholder">
          Shape: {model.asset.extras.knitwright.label}.
        </p>
      ) : null}
      {failed ? (
        <p className="text-sm text-muted">{FAILED_LABEL}</p>
      ) : (
        <canvas ref={canvas} className="block h-[26rem] w-full touch-none rounded-xl border border-hairline bg-white" role="img" aria-label={`${SIZE_LABEL} ${HELP_LABEL}`} />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESET_VIEWS.map((view) => (
          <Button key={view} type="button" variant="secondary" onClick={() => scene.current?.showView(view)}>
            {VIEW_LABELS[view]}
          </Button>
        ))}
        <span className="text-sm text-muted">{HELP_LABEL}</span>
      </div>
    </div>
  );
}

/**
 * The 3D view for an article with a base model. Without a model it shows the existing form made from the flat, so the
 * 3D button keeps working for every article. Like that viewer, it is loaded only when a person opens the 3D view.
 */
export default function ModelViewer({ model, layout, panelPictures, ...form }: ModelViewerProps) {
  return chooseViewer(model) === "model" && model ? <GltfView model={model} layout={layout} panelPictures={panelPictures} /> : <GarmentViewer {...form} />;
}
