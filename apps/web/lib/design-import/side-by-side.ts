import type { LandmarkId } from "@/lib/production/contract";
import type { ViewId } from "@/lib/artwork-stack";
import type { ReadingPayload } from "./payload";
import type { ReportItem } from "./report";
import { confidenceWords } from "./types";

/**
 * What the side-by-side screen shows, worked out once and tested: the confidence of each layer in words, an outline
 * and a handle for each landmark in the picture's pixels, and the limits that are always on screen.
 */

export const HANDLE_LABELS: Readonly<Record<LandmarkId, string>> = {
  hps: "High point of the shoulder",
  "shoulder-point": "Shoulder point",
  underarm: "Underarm",
  "cf-neck": "Centre front of the neck",
  "cf-hem": "Centre front of the hem",
  "cb-neck": "Centre back of the neck",
  "cb-hem": "Centre back of the hem",
  "side-hem": "Side of the hem",
  "cap-top": "Top of the sleeve",
  "underarm-a": "Sleeve underarm, upper",
  "underarm-b": "Sleeve underarm, lower",
  "hem-a": "Sleeve end, upper",
  "hem-b": "Sleeve end, lower",
};

export const CONFIDENCE_TEXT = { high: "High confidence", medium: "Medium confidence", low: "Low confidence: check this" } as const;

export interface LayerRow {
  readonly id: string;
  readonly label: string;
  readonly confidenceText: string;
  readonly confidence: number;
  readonly note: string;
}

export interface Handle {
  readonly id: LandmarkId;
  readonly side: "left" | "centre" | "right";
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly origin: "found" | "model-guess" | "moved-by-you";
  readonly confidenceText: string;
}

export interface ViewDrawing {
  readonly view: ViewId;
  /** SVG polygon points, in the picture's pixels. */
  readonly outline: string;
  readonly ground: string;
  readonly handles: readonly Handle[];
}

export interface SideBySide {
  readonly heading: string;
  readonly picture: { readonly width: number; readonly height: number };
  readonly layers: readonly LayerRow[];
  readonly colours: readonly { readonly id: string; readonly role: string; readonly hex: string }[];
  readonly items: readonly ReportItem[];
  readonly views: readonly ViewDrawing[];
  readonly missing: readonly { readonly view: ViewId; readonly note: string }[];
  readonly warnings: readonly string[];
  readonly limits: readonly string[];
  readonly notReadYet: readonly string[];
  readonly fittedTo: string;
}

const sideWord = { left: "left", right: "right", centre: "" } as const;
const handleLabel = (id: LandmarkId, side: Handle["side"]): string => `${HANDLE_LABELS[id]}${side === "centre" ? "" : `, ${sideWord[side]}`}`;

export function sideBySideOf(reading: ReadingPayload): SideBySide | null {
  const { report, stack, landmarks } = reading;
  if (report === null || stack === null || landmarks === null) return null;
  const groundLayer = stack.layers.find((layer) => layer.kind === "ground");
  const groundColour = stack.colours.find((colour) => colour.id === (groundLayer?.kind === "ground" ? groundLayer.colourId : "main"));
  const ground = groundColour?.screen ?? "#ffffff";
  const layers = stack.layers.map((layer): LayerRow => {
    const source = report.items.find((entry) => entry.layerId === layer.id);
    const confidence = source?.confidence ?? 0;
    return {
      id: layer.id,
      label: layer.name ?? layer.id,
      confidence,
      confidenceText: CONFIDENCE_TEXT[confidenceWords(confidence)],
      note: source?.note ?? "Read from the picture.",
    };
  });
  return {
    heading: report.heading,
    picture: landmarks.picture,
    layers,
    colours: stack.colours.map((colour) => ({ id: colour.id, role: colour.role, hex: colour.screen ?? "#ffffff" })),
    items: report.items,
    views: landmarks.views.map((view): ViewDrawing => ({
      view: view.view,
      outline: view.polygon.map((p) => `${p.x},${p.y}`).join(" "),
      ground,
      handles: view.landmarks.map((landmark): Handle => ({
        id: landmark.id,
        side: landmark.side,
        x: landmark.at.x,
        y: landmark.at.y,
        label: handleLabel(landmark.id, landmark.side),
        origin: landmark.origin,
        confidenceText: CONFIDENCE_TEXT[confidenceWords(landmark.confidence)],
      })),
    })),
    missing: report.missing,
    warnings: report.warnings,
    limits: report.limits,
    notReadYet: report.notReadYet,
    fittedTo: report.fittedTo,
  };
}
