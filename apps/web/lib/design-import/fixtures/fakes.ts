import { createStubProvider, type StubProvider } from "@/lib/providers/stub";
import type { ImageCleanup } from "../cleanup";
import type { Raster } from "../raster";

/** A recorded vision reply for a picture, as a model would give it through the reading tool. */
export const recordedReading = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    kind: "flat",
    garmentType: "team jersey",
    views: [{ view: "front", box: { x: 0, y: 0, w: 1, h: 1 } }],
    marks: [],
    colours: ["#1b2a49"],
    landmarkGuesses: [],
    ...overrides,
  });

export const replayProvider = (...replies: string[]): StubProvider => createStubProvider(replies);

/** A clean-up that hands back a given picture and records what it was asked to do. */
export function fakeCleanup(result: Raster): ImageCleanup & { readonly tasks: string[] } {
  const tasks: string[] = [];
  return {
    tasks,
    run: async (_raster, task) => {
      tasks.push(task);
      return result;
    },
  };
}
