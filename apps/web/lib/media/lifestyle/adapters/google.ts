import { readJson } from "@/lib/http/read-json";
import { z } from "zod";
import { ProviderError } from "@/lib/providers/image-provider";
import type { LifestyleProvider } from "../provider";
import { fromBase64, send, toBase64, type Fetch } from "./http";

/**
 * Google Vertex AI: Imagen product recontext (scene replacement) and Virtual Try-On, both over the REST `predict` method
 * (https://cloud.google.com/vertex-ai/generative-ai/docs/image/product-recontext and .../virtual-try-on). Licence note:
 * commercial services under Google Cloud's terms; nothing is copied. Neither call sets a seed: a seed needs the provider's
 * invisible SynthID mark turned off, and we want that mark kept, so a retry is different because the call is. Written from
 * the public documentation and never called by the tests: unverified against the live service until a key exists.
 */

export const RECONTEXT_NAME = "google-recontext";
export const TRYON_NAME = "google-tryon";
export const RECONTEXT_MODEL = "imagen-product-recontext-preview-06-30";
export const TRYON_MODEL = "virtual-try-on-001";

/** Knitwright estimates, not Google's price list. */
export const RECONTEXT_COST_MICRODOLLARS = 120_000;
export const TRYON_COST_MICRODOLLARS = 60_000;

export type GoogleOptions = Readonly<{
  /** A short-lived OAuth access token for a service account that may call Vertex AI. Owner question: how it is refreshed. */
  accessToken: string;
  project: string;
  location: string;
  fetch?: Fetch;
}>;

const answerSchema = z.object({ predictions: z.array(z.object({ bytesBase64Encoded: z.string().optional() })).optional() });

const image = (bytes: Uint8Array) => ({ image: { bytesBase64Encoded: toBase64(bytes) } });

async function predict(options: GoogleOptions, model: string, body: unknown, signal: AbortSignal): Promise<Uint8Array> {
  const { accessToken, project, location, fetch: fetcher = fetch } = options;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;
  const response = await send(fetcher, "The image service", url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    signal,
  });
  const parsed = answerSchema.safeParse(await readJson(response));
  const first = parsed.success ? parsed.data.predictions?.[0]?.bytesBase64Encoded : undefined;
  if (!first) throw new ProviderError("The image service returned no picture.", false);
  return fromBase64(first, "The image service");
}

export const createRecontextProvider = (options: GoogleOptions): LifestyleProvider => ({
  name: RECONTEXT_NAME,
  costMicrodollars: RECONTEXT_COST_MICRODOLLARS,
  scenes: ["pitch", "changing_room", "street"],
  generate: ({ prompt, reference }, signal) =>
    predict(options, RECONTEXT_MODEL, { instances: [{ prompt, productImages: [image(reference)] }], parameters: { sampleCount: 1 } }, signal),
});

export const createGoogleTryOnProvider = (options: GoogleOptions): LifestyleProvider => ({
  name: TRYON_NAME,
  costMicrodollars: TRYON_COST_MICRODOLLARS,
  scenes: ["on_model"],
  needsModelImage: true,
  generate: async ({ reference, modelImage }, signal) => {
    if (!modelImage) throw new ProviderError("No picture of a person is set up for the try-on.", true);
    return predict(options, TRYON_MODEL, { instances: [{ personImage: image(modelImage), productImages: [image(reference)] }], parameters: { sampleCount: 1 } }, signal);
  },
});
