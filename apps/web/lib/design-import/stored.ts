import { z } from "zod";
import { VIEW_IDS } from "@/lib/artwork-stack";
import { LANDMARK_IDS } from "@/lib/production/contract";
import type { StoredLandmarks } from "./pipeline";

const point = z.object({ x: z.number().finite().min(-10_000).max(10_000), y: z.number().finite().min(-10_000).max(10_000) });

const landmark = z.object({
  id: z.enum(LANDMARK_IDS),
  side: z.enum(["left", "centre", "right"]),
  at: point,
  confidence: z.number().min(0).max(1),
  origin: z.enum(["found", "model-guess", "moved-by-you"]),
});

export const storedLandmarksSchema = z.object({
  picture: z.object({ width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096) }),
  size: z.string().min(1).max(16),
  views: z
    .array(
      z.object({
        view: z.enum(VIEW_IDS),
        box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
        polygon: z.array(point).max(400),
        landmarks: z.array(landmark).max(40),
        kind: z.enum(["flat", "photo"]),
      }),
    )
    .max(5),
});

/** The stored landmarks, or null if the stored JSON is not a set. */
export function parseStored(input: unknown): StoredLandmarks | null {
  const parsed = storedLandmarksSchema.safeParse(input);
  return parsed.success ? (parsed.data as StoredLandmarks) : null;
}
