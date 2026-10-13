"use client";

import { useEffect, useState } from "react";
import type { GarmentSpec } from "@/lib/garment";
import { colourAction, type ColourChange } from "@/lib/projects/colour-controls";
import { createSettler } from "@/lib/projects/debounce";
import type { Request } from "@/lib/projects/editor-state";
import { colourKey } from "./keys";

type Queue = (key: string, request: Request, focus: boolean) => void;
type Problem = (key: string, message: string, focus: boolean) => void;

/**
 * Colour changes for the editor. Each is kept as the change to one part and worked out into
 * a colourway change only when it is sent, on top of everything saved before it, so a second
 * colour never undoes the first. It is checked against `working` at once, so a mistake shows
 * straight away. A pick from the colour picker is held until the person stops moving, and the
 * newest one is sent.
 */
export function useColourEdits(working: GarmentSpec, colourwayId: string, queue: Queue, problem: Problem) {
  const [settler] = useState(() =>
    createSettler<Request>((key, request, asked) => queue(key, request, asked)),
  );
  useEffect(() => () => settler.cancel(), [settler]);

  /** The change as a request, or null when it was refused and the reason shown. */
  const checked = (panelId: string, change: ColourChange, asked: boolean): Request | null => {
    const made = colourAction(working, panelId, change, colourwayId);
    if (made.kind === "problem") {
      problem(colourKey(panelId), made.reason, asked);
      return null;
    }
    return { kind: "colour", panelId, change, colourwayId };
  };

  return {
    changeColour: (panelId: string, change: ColourChange, asked: boolean) => {
      const request = checked(panelId, change, asked);
      if (request) queue(colourKey(panelId), request, asked);
    },
    pickSwatch: (panelId: string, swatch: string) => {
      const request = checked(panelId, { swatch }, false);
      if (request) settler.change(colourKey(panelId), request);
    },
    settleSwatch: (panelId: string) => settler.flush(colourKey(panelId), false),
  };
}
