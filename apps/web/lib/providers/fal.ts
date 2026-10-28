import { readJson } from "@/lib/http/read-json";
import { z } from "zod";
import { ProviderError, type GeneratedImage, type ImageProvider } from "./image-provider";

/**
 * Google's Nano Banana 2 image model, resold by fal.ai and called over plain HTTPS. Chosen by
 * the owner on 2026-10-13 in place of Google directly. fal's terms do not rule out using
 * de-identified data to develop models, and it keeps payloads for 30 days unless asked not to,
 * so every call asks it to keep nothing (docs/data-processing.md).
 */

export const FAL_IMAGE_MODEL = "fal-ai/nano-banana-2/edit";

const ENDPOINT = `https://fal.run/${FAL_IMAGE_MODEL}`;

/** fal's file host. A picture is fetched only from here, never from an address fal names elsewhere. */
const FILE_HOST = /^https:\/\/(?:[a-z0-9-]+\.)*fal\.media\//;

/** Largest picture accepted back, in bytes. A 1K PNG is a few megabytes. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** How long fal may keep a picture on its file host, in seconds, when it stores one at all. */
const FILE_LIFETIME_SECONDS = 600;

const answerSchema = z.object({
  images: z.array(z.object({ url: z.string(), content_type: z.string().optional() })).optional(),
});

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

type FalOptions = Readonly<{ apiKey: string; fetch?: Fetch }>;

const DATA_ADDRESS = /^data:([^;,]+)?;base64,([A-Za-z0-9+/=]*)$/;

/** 4xx other than a rate limit: the key, the account or the content. Retrying cannot help. */
const refusedStatus = (status: number): boolean => status >= 400 && status < 500 && status !== 429;

const tooLarge = (): ProviderError => new ProviderError("The image model returned a picture that is too large.", false);

function fromDataAddress(url: string, declared: string | undefined): GeneratedImage | null {
  const match = DATA_ADDRESS.exec(url);
  if (!match) return null;
  const data = match[2] ?? "";
  // Base64 is four characters for every three bytes.
  if ((data.length * 3) / 4 > MAX_IMAGE_BYTES) throw tooLarge();
  return { bytes: new Uint8Array(Buffer.from(data, "base64")), contentType: match[1] ?? declared ?? "image/png" };
}

async function fromFileHost(url: string, declared: string | undefined, fetcher: Fetch, signal?: AbortSignal): Promise<GeneratedImage> {
  if (!FILE_HOST.test(url)) throw new ProviderError("The image model named a picture outside its file host.", false);
  let response: Response;
  try {
    response = await fetcher(url, { method: "GET", signal });
  } catch (error) {
    throw new ProviderError("The picture could not be fetched.", false, { cause: error });
  }
  if (!response.ok) throw new ProviderError(`The picture could not be fetched (${response.status}).`, false);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) throw tooLarge();
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw tooLarge();
  return { bytes, contentType: response.headers.get("content-type") ?? declared ?? "image/png" };
}

export function createFalProvider({ apiKey, fetch: fetcher = fetch }: FalOptions): ImageProvider {
  return {
    name: `fal:${FAL_IMAGE_MODEL}`,
    async generate({ prompt, reference }, signal) {
      let response: Response;
      try {
        response = await fetcher(ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Key ${apiKey}`,
            "x-fal-store-io": "0",
            "x-fal-object-lifecycle-preference": JSON.stringify({ expiration_duration_seconds: FILE_LIFETIME_SECONDS }),
          },
          body: JSON.stringify({
            prompt,
            image_urls: [`data:image/png;base64,${Buffer.from(reference).toString("base64")}`],
            num_images: 1,
            aspect_ratio: "1:1",
            resolution: "1K",
            output_format: "png",
            // The picture comes back in the answer and is not kept in fal's request history.
            sync_mode: true,
          }),
          signal,
        });
      } catch (error) {
        throw new ProviderError("The image model could not be reached.", false, { cause: error });
      }

      if (!response.ok) {
        // The provider's text goes to the log through `cause`, never to the user.
        const detail = await response.text().catch(() => "");
        throw new ProviderError(`The image model refused the request (${response.status}).`, refusedStatus(response.status), {
          cause: detail.slice(0, 500),
        });
      }

      const parsed = answerSchema.safeParse(await readJson(response));
      const first = parsed.success ? parsed.data.images?.[0] : undefined;
      if (!first) throw new ProviderError("The image model returned no picture.", false);
      return fromDataAddress(first.url, first.content_type) ?? fromFileHost(first.url, first.content_type, fetcher, signal);
    },
  };
}
