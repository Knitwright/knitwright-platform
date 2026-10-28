import type { LifestyleProvider } from "../provider";
import { readBytes, send, type Fetch } from "./http";

/**
 * Photoroom Image Editing API, v2 `edit`: the subject is cut out and a new background is made from a text prompt
 * (https://docs.photoroom.com/image-editing-api-plus-plan). Scene replacement only. Licence note: a commercial service
 * under Photoroom's terms and an API key; no code or weights are copied. Written from the public documentation and never
 * called by the tests: unverified against the live service until a key exists.
 */

const PHOTOROOM_NAME = "photoroom";
const ENDPOINT = "https://image-api.photoroom.com/v2/edit";

/** A Knitwright estimate, not Photoroom's price list. Reserved so the cap errs on the side of caution. */
const PHOTOROOM_COST_MICRODOLLARS = 100_000;

type PhotoroomOptions = Readonly<{ apiKey: string; fetch?: Fetch }>;

export function createPhotoroomProvider({ apiKey, fetch: fetcher = fetch }: PhotoroomOptions): LifestyleProvider {
  return {
    name: PHOTOROOM_NAME,
    costMicrodollars: PHOTOROOM_COST_MICRODOLLARS,
    scenes: ["pitch", "changing_room", "street"],
    async generate({ prompt, seed, reference }, signal) {
      const form = new FormData();
      form.set("imageFile", new Blob([Buffer.from(reference)], { type: "image/png" }), "garment.png");
      form.set("background.prompt", prompt);
      form.set("background.seed", String(seed));
      form.set("outputSize", "1024x1024");
      // Keep the garment where the design puts it instead of centring and rescaling it.
      form.set("referenceBox", "originalImage");
      form.set("padding", "0");
      form.set("export.format", "png");
      const response = await send(fetcher, "The scene service", ENDPOINT, { method: "POST", headers: { "x-api-key": apiKey, accept: "image/png" }, body: form, signal });
      return readBytes(response, "The scene service");
    },
  };
}
