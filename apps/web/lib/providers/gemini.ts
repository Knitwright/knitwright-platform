import { z } from "zod";
import { ProviderError, type GeneratedImage, type ImageProvider } from "./image-provider";

/**
 * Google's Gemini image model, called over plain HTTPS. The provisional choice in
 * docs/data-processing.md: on the paid tier Google does not train on prompts or pictures.
 * A key from the free tier would let Google use and review them, so the key must belong
 * to a project with billing turned on (owner question 2).
 */

export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

/** Largest picture accepted back, in bytes. A 1K PNG is a few megabytes. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const inline = z.object({ mimeType: z.string().optional(), mime_type: z.string().optional(), data: z.string() });

const partSchema = z.object({
  text: z.string().optional(),
  inlineData: inline.optional(),
  inline_data: inline.optional(),
});

const answerSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(partSchema).optional() }).optional() }))
    .optional(),
});

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export type GeminiOptions = Readonly<{ apiKey: string; fetch?: Fetch }>;

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

const imageFrom = (body: unknown): GeneratedImage => {
  const parsed = answerSchema.safeParse(body);
  const parts = parsed.success
    ? (parsed.data.candidates ?? []).flatMap((candidate) => candidate.content?.parts ?? [])
    : [];
  const found = parts.map((part) => part.inlineData ?? part.inline_data).find(Boolean);
  if (!found) throw new ProviderError("The image model returned no picture.", false);
  // Base64 is four characters for every three bytes.
  if ((found.data.length * 3) / 4 > MAX_IMAGE_BYTES) {
    throw new ProviderError("The image model returned a picture that is too large.", false);
  }
  return {
    bytes: new Uint8Array(Buffer.from(found.data, "base64")),
    contentType: found.mimeType ?? found.mime_type ?? "image/png",
  };
};

/** 401 and 403: the key or the account. Retrying cannot help. 429 is a rate limit. */
const REFUSED = new Set([400, 401, 402, 403]);

export function createGeminiProvider({ apiKey, fetch: fetcher = fetch }: GeminiOptions): ImageProvider {
  return {
    name: `gemini:${GEMINI_IMAGE_MODEL}`,
    async generate({ prompt, reference }, signal) {
      let response: Response;
      try {
        response = await fetcher(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: "image/png", data: toBase64(reference) } },
                ],
              },
            ],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1" } },
          }),
          signal,
        });
      } catch (error) {
        throw new ProviderError("The image model could not be reached.", false, { cause: error });
      }

      if (!response.ok) {
        // The provider's text goes to the log through `cause`, never to the user.
        const detail = await response.text().catch(() => "");
        throw new ProviderError(`The image model refused the request (${response.status}).`, REFUSED.has(response.status), {
          cause: detail.slice(0, 500),
        });
      }

      return imageFrom(await response.json().catch(() => null));
    },
  };
}
