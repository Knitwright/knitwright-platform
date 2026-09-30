import { z } from "zod";
import { expectedSchema, startSchema } from "./replay";

/**
 * Proposed golden image cases for the families built after tops (steps 18, 21 and 24). Each
 * case describes an image the owner is to supply (owner action A8), the design it is read
 * against, and the outcome it should have. An applied outcome is the proposal shown on the
 * review screen, which the person confirms before anything changes (step 13).
 *
 * No image exists yet, so `file` is null and nothing is replayed. `image-cases.ts` joins these
 * cases to the step 13 image harness (`scripts/eval-images.mts`); the owner puts each picture in
 * `golden/images/` and names it in `file`.
 */
const imageCaseSchema = z.strictObject({
  id: z.string(),
  category: z.string(),
  image: z.strictObject({
    /** What the image shows, in plain words, so the owner can find or draw it. */
    describes: z.string().min(1),
    /** The image file, once the owner supplies it. */
    file: z.string().nullable(),
  }),
  /** Words sent with the image, if any. */
  utterance: z.string(),
  start: startSchema,
  expected: expectedSchema,
  /** True only when the owner has supplied the image and approved this case (owner action A8). */
  approved: z.boolean(),
});
export type GoldenImageCase = z.output<typeof imageCaseSchema>;

export const imageSetSchema = z.strictObject({
  family: z.string(),
  status: z.enum(["proposed", "approved"]),
  note: z.string(),
  cases: z.array(imageCaseSchema),
});
