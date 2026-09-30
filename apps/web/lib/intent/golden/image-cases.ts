import type { ImageCase } from "./image-replay";
import { imageSetSchema as harnessSetSchema } from "./image-replay";
import bottoms from "./images-bottoms.json";
import closeFitting from "./images-close-fitting.json";
import outerwear from "./images-outerwear.json";
import { imageSetSchema as familySetSchema, type GoldenImageCase } from "./images";
import tops from "./images/images.json";

/**
 * Joins the proposed golden images of the families built after tops (steps 18, 21, 24) to the
 * image harness of step 13. A family case becomes a harness case once the owner supplies its
 * picture (A8). The image path takes no words and asks no question (the person confirms on the
 * review screen instead), so a case with words or an expected question is left out, with why.
 */

export type Converted =
  | Readonly<{ ok: true; entry: ImageCase }>
  | Readonly<{ ok: false; id: string; reason: string }>;

export function toImageCase(entry: GoldenImageCase): Converted {
  const skip = (reason: string): Converted => ({ ok: false, id: entry.id, reason });
  if (entry.image.file === null) return skip("No image yet (owner action A8).");
  if (entry.utterance.trim() !== "") return skip("It sends words with the picture, which the image path does not take.");
  if (entry.expected.kind === "question") return skip("It expects a question, which the image path never asks.");
  const expected: ImageCase["expected"] =
    entry.expected.kind === "rejection"
      ? { kind: "rejection" }
      : {
          kind: "proposal",
          typeId: entry.expected.typeId ?? entry.start.typeId,
          ...(entry.expected.options ? { options: entry.expected.options } : {}),
        };
  return {
    ok: true,
    entry: {
      id: entry.id,
      file: entry.image.file,
      kind: entry.category === "sketch" ? "sketch" : "photo",
      start: entry.start,
      expected,
      approved: entry.approved,
    },
  };
}

const FAMILY_SETS = [bottoms, outerwear, closeFitting] as const;

/** Every golden image case the harness can run today, and every family case it cannot yet, with why. */
export function allGoldenImageCases(): { cases: ImageCase[]; skipped: { id: string; reason: string }[] } {
  const cases: ImageCase[] = [...harnessSetSchema.parse(tops).cases];
  const skipped: { id: string; reason: string }[] = [];
  for (const raw of FAMILY_SETS) {
    for (const entry of familySetSchema.parse(raw).cases) {
      const converted = toImageCase(entry);
      if (converted.ok) cases.push(converted.entry);
      else skipped.push({ id: converted.id, reason: converted.reason });
    }
  }
  return { cases, skipped };
}
