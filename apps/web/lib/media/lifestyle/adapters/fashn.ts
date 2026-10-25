import { z } from "zod";
import { ProviderError } from "@/lib/providers/image-provider";
import type { LifestyleProvider } from "../provider";
import { fromBase64, send, sleep, toBase64, type Fetch } from "./http";

/**
 * FASHN virtual try-on, `tryon-v1.6` over the REST API (https://docs.fashn.ai): start a run, then ask for its status until
 * it completes. Licence note: a commercial service under FASHN's terms with an API key; no code or weights are copied.
 * Written from the public documentation and never called by the tests: unverified against the live service until a key exists.
 */

export const FASHN_NAME = "fashn";
export const FASHN_MODEL = "tryon-v1.6";
const BASE = "https://api.fashn.ai/v1";

/** A Knitwright estimate, not FASHN's price list. */
export const FASHN_COST_MICRODOLLARS = 75_000;

export type FashnOptions = Readonly<{ apiKey: string; fetch?: Fetch; pollMs?: number; maxPolls?: number }>;

const startSchema = z.object({ id: z.string().min(1) });
const statusSchema = z.object({ status: z.string(), output: z.array(z.string()).nullish(), error: z.unknown().optional() });

const dataUri = (bytes: Uint8Array) => `data:image/png;base64,${toBase64(bytes)}`;

export function createFashnProvider({ apiKey, fetch: fetcher = fetch, pollMs = 1500, maxPolls = 30 }: FashnOptions): LifestyleProvider {
  const headers = { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
  return {
    name: FASHN_NAME,
    costMicrodollars: FASHN_COST_MICRODOLLARS,
    scenes: ["on_model"],
    needsModelImage: true,
    async generate({ reference, modelImage, seed }, signal) {
      if (!modelImage) throw new ProviderError("No picture of a person is set up for the try-on.", true);
      const body = JSON.stringify({
        model_name: FASHN_MODEL,
        inputs: { model_image: dataUri(modelImage), garment_image: dataUri(reference), category: "auto", seed, num_samples: 1, output_format: "png", return_base64: true },
      });
      const started = startSchema.safeParse(await (await send(fetcher, "The try-on service", `${BASE}/run`, { method: "POST", headers, body, signal })).json().catch(() => null));
      if (!started.success) throw new ProviderError("The try-on service did not start the run.", false);
      for (let poll = 0; poll < maxPolls; poll++) {
        await sleep(pollMs, signal);
        const status = statusSchema.safeParse(await (await send(fetcher, "The try-on service", `${BASE}/status/${started.data.id}`, { method: "GET", headers, signal })).json().catch(() => null));
        if (!status.success) throw new ProviderError("The try-on service gave an answer that could not be read.", false);
        if (status.data.status === "completed") {
          const first = status.data.output?.[0];
          if (!first) throw new ProviderError("The try-on service returned no picture.", false);
          return fromBase64(first, "The try-on service");
        }
        if (status.data.status === "failed") throw new ProviderError("The try-on service could not make the picture.", false, { cause: status.data.error });
      }
      throw new ProviderError("The try-on service took too long.", false);
    },
  };
}
