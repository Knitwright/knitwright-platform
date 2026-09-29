import type { GarmentSpec, SpecAction } from "@/lib/garment";
import { IMAGE_UNAVAILABLE, runImageIntent, type Confirmation } from "@/lib/intent/image-input";
import { rejection } from "@/lib/intent/outcome";
import { IMAGE_INPUT_TOKENS, MAX_OUTPUT_TOKENS, MAX_TEXT_INPUT_TOKENS, callCost, type ModelEntry } from "@/lib/providers/catalog";
import { MODEL_IMAGE_TYPES, type ModelImageType, type TextModelProvider } from "@/lib/providers/text-model";
import type { LogEvent } from "@/lib/server/core/guard";
import type { RouteUsage } from "@/lib/server/core/metered";
import { TOO_LARGE, type StoredBytes } from "@/lib/storage/read";
import type { Cost } from "@/lib/usage/cost";
import type { FlatPreviewData } from "./flat-preview";

/**
 * The work behind reading an uploaded sketch or photo (plan step 13), with every outside
 * service passed in. The picture is read from the brand's own files, sent to the vision
 * model, and turned into a proposal the person reviews. Nothing is saved here.
 */

/** The largest picture sent to a model. Anthropic accepts 5 MB an image. */
export const VISION_MAX_BYTES = 5 * 1024 * 1024;

export const NOT_FOUND = "That picture could not be found. Upload it again. Nothing was changed.";
export const TOO_LARGE_TO_READ = `That picture is too large to read. Use one under ${VISION_MAX_BYTES / (1024 * 1024)} MB. Nothing was changed.`;
export const NOT_READABLE_TYPE = "That picture cannot be read. Upload a PNG, JPEG or WebP image. Nothing was changed.";
export const IMAGE_FAILED = "The picture could not be read just now. Nothing was changed. Try again in a moment.";

/** The most a reading can cost: the instructions, the picture and the fixed output limit. */
export const imageCost = (entry: ModelEntry): Cost => ({
  feature: "ai",
  microdollars: callCost(entry, MAX_TEXT_INPUT_TOKENS + IMAGE_INPUT_TOKENS, MAX_OUTPUT_TOKENS),
});

export type ImageRequestResult =
  | {
      readonly kind: "proposal";
      readonly explanations: readonly string[];
      readonly notes: readonly string[];
      readonly confirmations: readonly Confirmation[];
      /** The signed changes, handed back to apply them once confirmed. */
      readonly token: string;
      /** The proposed design drawn, front and back, or null for a type with no drawing. */
      readonly flat: FlatPreviewData | null;
    }
  | { readonly kind: "rejection"; readonly reason: string };

export interface ImageRequestDeps {
  readonly spec: GarmentSpec;
  readonly fileId: string;
  /** Reads a file of the brand in the session, or null. */
  readonly readFile: (fileId: string, maxBytes: number) => Promise<StoredBytes | typeof TOO_LARGE | null>;
  /** The vision model, or null when none is configured. */
  readonly provider: TextModelProvider | null;
  readonly usage: RouteUsage | null;
  readonly sign: (actions: readonly SpecAction[], explanations: readonly string[]) => string;
  readonly preview: (spec: GarmentSpec) => FlatPreviewData | null;
  readonly log: (event: LogEvent) => void;
  readonly timeoutMs: number;
}

const isModelType = (type: string): type is ModelImageType => (MODEL_IMAGE_TYPES as readonly string[]).includes(type);

async function refused(deps: ImageRequestDeps, reason: string): Promise<ImageRequestResult> {
  await deps.usage?.refund();
  return rejection(reason);
}

export async function readImageRequest(deps: ImageRequestDeps): Promise<ImageRequestResult> {
  if (!deps.provider) return rejection(IMAGE_UNAVAILABLE);
  const file = await deps.readFile(deps.fileId, VISION_MAX_BYTES);
  if (file === null) return refused(deps, NOT_FOUND);
  if (file === TOO_LARGE) return refused(deps, TOO_LARGE_TO_READ);
  if (!isModelType(file.contentType)) return refused(deps, NOT_READABLE_TYPE);
  const image = { mediaType: file.contentType, base64: Buffer.from(file.bytes).toString("base64") };
  let outcome: Awaited<ReturnType<typeof runImageIntent>>;
  try {
    outcome = await runImageIntent({ spec: deps.spec, image, signal: AbortSignal.timeout(deps.timeoutMs) }, deps.provider);
  } catch (error) {
    deps.log({ level: "error", message: "A picture could not be read by the model", where: "assistant image request", error });
    return refused(deps, IMAGE_FAILED);
  }
  if (outcome.kind === "rejection") return outcome;
  return {
    kind: "proposal",
    explanations: outcome.explanations,
    notes: outcome.notes,
    confirmations: outcome.confirmations,
    token: deps.sign(outcome.actions, outcome.explanations),
    flat: deps.preview(outcome.spec),
  };
}
