import { z } from "zod";
import { LOGO_RIGHTS_MISSING } from "@/lib/storage/rights";

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

/**
 * Uploads a picture for the design's artwork. `post` sends the form to the upload route.
 * `rightsConfirmed` is the box saying the person owns the logo or may use it on garments;
 * without it nothing is sent, and the route refuses it too (decision 0025).
 */
export const uploadArtworkFile = async (file: File, post: (form: FormData) => Promise<Response>, rightsConfirmed: boolean): Promise<UploadResult> =>
  rightsConfirmed ? send(file, "artwork", post) : { ok: false, reason: LOGO_RIGHTS_MISSING };

/** Uploads a sketch or photo to read. It is never printed, so it needs no rights box. */
export const uploadImageFile = (file: File, kind: "sketch" | "photo", post: (form: FormData) => Promise<Response>): Promise<UploadResult> =>
  send(file, kind, post);

/** Sends a picture through the one upload route (step 3): artwork, or a sketch or photo to read. */
async function send(
  file: File,
  kind: "artwork" | "sketch" | "photo",
  post: (form: FormData) => Promise<Response>,
): Promise<UploadResult> {
  const problem = checkUploadFile(file);
  if (problem) return { ok: false, reason: problem };
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
  // Artwork reaches here only once the box is ticked (uploadArtworkFile).
  if (kind === "artwork") form.set("rights", "yes");
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
