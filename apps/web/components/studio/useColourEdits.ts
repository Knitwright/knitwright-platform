"use client";

import { useEffect, useState } from "react";
import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { colourAction, type ColourChange } from "@/lib/projects/colour-controls";
import { createSettler } from "@/lib/projects/debounce";
import type { Request } from "@/lib/projects/editor-state";
import { colourKey } from "./keys";

type Queue = (key: string, request: Request, focus: boolean) => void;
type Problem = (key: string, message: string, focus: boolean) => void;

/**
 * Colour changes for the editor. Each is worked out from `working`, the design as it will
 * be once the waiting changes are saved, so a second colour does not undo the first. A pick
 * from the colour picker is held until the person stops moving, and the newest one is sent.
 */
export function useColourEdits(working: GarmentSpec, colourwayId: string, queue: Queue, problem: Problem) {
  const [settler] = useState(() =>
    createSettler<SpecAction>((key, action, asked) => queue(key, { kind: "action", action }, asked)),
  );
  useEffect(() => () => settler.cancel(), [settler]);

  return {
    changeColour: (panelId: string, change: ColourChange, asked: boolean) => {
      const request = colourAction(working, panelId, change, colourwayId);
      if (request.kind === "problem") problem(colourKey(panelId), request.reason, asked);
      else queue(colourKey(panelId), request, asked);
    },
    pickSwatch: (panelId: string, swatch: string) => {
      const request = colourAction(working, panelId, { swatch }, colourwayId);
      if (request.kind === "problem") problem(colourKey(panelId), request.reason, false);
      else settler.change(colourKey(panelId), request.action);
    },
    settleSwatch: (panelId: string) => settler.flush(colourKey(panelId), false),
  };
}
