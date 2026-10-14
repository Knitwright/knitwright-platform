/**
 * The one interface every text and vision model is called through (plan step 12, task 1).
 * The intent library never sees a vendor: it gets the reply as text and parses it itself,
 * so a provider cannot make anything reach a design without the parser and the rules.
 */

export const MODEL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ModelImageType = (typeof MODEL_IMAGE_TYPES)[number];

export interface ModelImage {
  readonly mediaType: ModelImageType;
  /** The picture's bytes in base64, without a data: prefix. */
  readonly base64: string;
}

/** A reply tool of the caller's own, for a call whose answer is not a garment change (W7d reads a picture into one). */
export interface ReplyToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ModelRequest {
  /** The fixed instructions. */
  readonly system: string;
  /** The current design and the person's words, as data. */
  readonly user: string;
  /** A sketch or photo to read, for a vision call. */
  readonly image?: ModelImage;
  /** A hard limit on the reply. Fixed by the caller, never by the person. */
  readonly maxOutputTokens: number;
  /** Replaces the garment reply tool for this call. Left out, the garment reply tool is used. */
  readonly replyTool?: ReplyToolSpec;
  readonly signal?: AbortSignal;
}

export interface ModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ModelReply {
  /**
   * The reply as text: the input the model gave the reply tool, written as JSON, or its
   * plain text when it did not use the tool. Untrusted either way.
   */
  readonly text: string;
  readonly model: string;
  readonly usage: ModelUsage;
}

export interface TextModelProvider {
  /** "anthropic", "openai", "stub". */
  readonly provider: string;
  /** The exact model id sent to the vendor. */
  readonly model: string;
  complete(request: ModelRequest): Promise<ModelReply>;
}

/** A call that did not produce a reply: no key, a network fault, a refusal by the vendor. */
export class ModelCallError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ModelCallError";
  }
}

/** A fetch function, so tests can supply their own. */
export type Fetch = (input: string, init: RequestInit) => Promise<Response>;
