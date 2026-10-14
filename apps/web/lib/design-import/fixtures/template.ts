import type { LandmarkId } from "@/lib/production/contract";
import type { LandmarkTemplate } from "../template";
import { TEE_TRUTH } from "./synthetic";

/** A template made from the synthetic tee's truth: design millimetres are the picture's pixels times 1.5, centred. */
export const SYNTHETIC_TEMPLATE: LandmarkTemplate = {
  size: "S",
  description: "the synthetic tee",
  landmarks(view) {
    if (view !== "front" && view !== "back") return {};
    const entries = Object.entries(TEE_TRUTH).map(([id, p]) => {
      const named: LandmarkId = view === "back" ? (id === "cf-neck" ? "cb-neck" : id === "cf-hem" ? "cb-hem" : (id as LandmarkId)) : (id as LandmarkId);
      return [named, { x: ((p?.x ?? 0) - 200) * 1.5, y: ((p?.y ?? 0) - 70) * 1.5 }] as const;
    });
    return Object.fromEntries(entries);
  },
};
