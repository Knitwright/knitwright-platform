import { scaling } from "@/lib/print/geometry/affine";
import { transformPiece } from "@/lib/print/frames/instances";
import { gradedPatternSchema, type GradedPattern } from "@/lib/production/contract";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";

/** Test sizes: the benchmark size 48 stretched by a plain factor each way. These are test numbers, not a grade rule. */
const FACTORS: Readonly<Record<string, readonly [number, number]>> = {
  XS: [0.9, 0.94],
  "48": [1, 1],
  "3XL": [1.3, 1.18],
};

function gradedFrom(base: GradedPattern): GradedPattern {
  const sizes = Object.keys(FACTORS);
  const source = base.piecesBySize["48"] ?? [];
  return gradedPatternSchema.parse({
    ...base,
    sizes,
    piecesBySize: Object.fromEntries(
      sizes.map((size) => {
        const [fx, fy] = FACTORS[size] as readonly [number, number];
        return [size, source.map((piece) => ({ ...transformPiece(piece, scaling(fx, fy)), sizeLabel: size }))];
      }),
    ),
  });
}

export const TEE_GRADED = gradedFrom(TEE_EU48);
export const JERSEY_GRADED = gradedFrom(JERSEY_EU48);
