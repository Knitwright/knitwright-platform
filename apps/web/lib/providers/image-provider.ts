/**
 * A hosted model that turns a flat drawing and a prompt into a picture. Plan step 14,
 * task 2. The app depends on this interface only, so the provider can change (the owner
 * has not chosen one yet, see docs/data-processing.md) and tests can use a stub.
 */

export interface ImageRequest {
  readonly prompt: string;
  /** The flat drawing, as a PNG. The model is asked to keep its shape and details. */
  readonly reference: Uint8Array;
}

export interface GeneratedImage {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface ImageProvider {
  /** Names the provider and model in logs. Never shown to users. */
  readonly name: string;
  generate(request: ImageRequest, signal?: AbortSignal): Promise<GeneratedImage>;
}

/**
 * A provider's failure. `refused` is true when retrying cannot help (the key, the
 * account or the content was refused). The provider's own text is kept for the log only.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly refused: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderError";
  }
}
