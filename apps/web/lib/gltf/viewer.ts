import { PREVIEW_LABEL } from "@/lib/garment3d/viewer";
import { TEXTURE_SIZE, type PanelLayout } from "./layout";

/** Shown beside the viewer at all times, as for the existing form. */
export const SIZE_LABEL = PREVIEW_LABEL;
export const PRESET_VIEWS = ["front", "back", "left", "right", "top"] as const;
export type PresetView = (typeof PRESET_VIEWS)[number];

export type Vec3 = readonly [number, number, number];
export interface ModelBox {
  readonly size: Vec3;
  readonly centre: Vec3;
}

const MARGIN = 1.15;

/** Whether to show a model or fall back to the form made from the flat. */
export const chooseViewer = (model: unknown): "model" | "form" => (model === null || model === undefined ? "form" : "model");

/** Where the camera stands for a preset view of the whole model, for this upright field of view (degrees) and frame shape. */
export function presetCamera(view: PresetView, box: ModelBox, fovDegrees: number, aspect: number): Vec3 {
  const half = Math.tan(((fovDegrees / 2) * Math.PI) / 180);
  const [w, h, d] = box.size;
  const [cx, cy, cz] = box.centre;
  const across = view === "left" || view === "right" ? d : w;
  const tall = view === "top" ? d : h;
  const depth = view === "left" || view === "right" ? w : view === "top" ? h : d;
  const distance = (Math.max(tall / 2, across / 2 / aspect) * MARGIN) / half + depth / 2;
  switch (view) {
    case "front":
      return [cx, cy, cz + distance];
    case "back":
      return [cx, cy, cz - distance];
    case "left":
      return [cx + distance, cy, cz];
    case "right":
      return [cx - distance, cy, cz];
    default:
      return [cx, cy + distance, cz];
  }
}

interface AtlasDraw {
  readonly panelId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where each panel render is drawn in the 2048 picture. Panels with no render are left out and show the material colour. */
export function atlasPlan(layout: PanelLayout, available: readonly string[]): { readonly size: number; readonly draws: readonly AtlasDraw[] } {
  return {
    size: TEXTURE_SIZE,
    draws: layout.panels
      .filter((p) => available.includes(p.id))
      .map((p) => ({
        panelId: p.id,
        x: p.rect.u0 * TEXTURE_SIZE,
        y: p.rect.v0 * TEXTURE_SIZE,
        width: (p.rect.u1 - p.rect.u0) * TEXTURE_SIZE,
        height: (p.rect.v1 - p.rect.v0) * TEXTURE_SIZE,
      })),
  };
}
