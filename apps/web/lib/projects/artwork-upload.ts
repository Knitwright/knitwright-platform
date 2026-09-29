import { z } from "zod";

/**
 * Sending a logo to the upload route, kept apart from the screen. The route checks and
 * rewrites the picture again on the server. These checks only save a round trip.
 */
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

const NOT_AN_IMAGE = "Upload a PNG, JPEG or WebP image.";
const EMPTY = "That file is empty. Choose another.";
const TOO_BIG = `Images can be ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB at most.`;
const FAILED = "The upload did not work. Try again.";
const UNREACHABLE = "We could not reach the server. Check your connection and try again.";

export const checkUploadFile = (file: Readonly<{ type: string; size: number }>): string | null => {
  if (!ACCEPTED.includes(file.type)) return NOT_AN_IMAGE;
  if (file.size === 0) return EMPTY;
  return file.size > UPLOAD_MAX_BYTES ? TOO_BIG : null;
};

export type UploadResult =
  | Readonly<{ ok: true; fileId: string; width: number; height: number }>
  | Readonly<{ ok: false; reason: string }>;

const answer = z.union([
  z.object({ success: z.literal(true), data: z.object({ id: z.uuid(), width: z.number(), height: z.number() }) }),
  z.object({ success: z.literal(false), error: z.object({ message: z.string() }) }),
]);

/** Uploads a picture for the design's artwork. `post` sends the form to the upload route. */
export async function uploadArtworkFile(file: File, post: (form: FormData) => Promise<Response>): Promise<UploadResult> {
  const problem = checkUploadFile(file);
  if (problem) return { ok: false, reason: problem };
  const form = new FormData();
  form.set("kind", "artwork");
  form.set("file", file);
  try {
    const response = await post(form);
    const parsed = answer.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { ok: false, reason: FAILED };
    if (!parsed.data.success) return { ok: false, reason: parsed.data.error.message };
    return { ok: true, fileId: parsed.data.data.id, width: parsed.data.data.width, height: parsed.data.data.height };
  } catch {
    return { ok: false, reason: UNREACHABLE };
  }
}
