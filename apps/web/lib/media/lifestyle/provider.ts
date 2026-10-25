import type { SceneId } from "./scenes";

/**
 * A model that puts the garment in a scene (product recontext) or on a person (virtual try-on). The app depends on this
 * interface only. A real one lives in `adapters/`, behind its own key; tests use the stub.
 */

export interface LifestyleRequest {
  readonly scene: SceneId;
  /** A fixed text chosen by scene (`scenes.ts`). */
  readonly prompt: string;
  /** Different on a retry, same for the same design and scene. */
  readonly seed: number;
  /** The design's own render on white: the garment to keep. */
  readonly reference: Uint8Array;
  /** The same garment on a transparent background. */
  readonly garment: Uint8Array;
  /** A picture of a person, for providers that dress one. Null when none is configured. */
  readonly modelImage: Uint8Array | null;
}

export interface LifestyleProvider {
  /** Names the provider in logs and on the picture's record. */
  readonly name: string;
  /** What one call is expected to cost, in millionths of a dollar. A Knitwright estimate, not the provider's price list. */
  readonly costMicrodollars: number;
  /** The scenes this provider can make. A try-on provider makes only `on_model`. */
  readonly scenes: readonly SceneId[];
  /** True for a try-on provider: it dresses the person in `modelImage` and has nothing to do without one. */
  readonly needsModelImage?: boolean;
  /** The picture, in any format sharp reads. Throws `ProviderError` (lib/providers) when it cannot. */
  generate(request: LifestyleRequest, signal: AbortSignal): Promise<Uint8Array>;
}
