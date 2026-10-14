import { createHash } from "node:crypto";
import type { PrintFileBuilder, PrintFileSpec } from "@/lib/production/contract";

/**
 * A print file builder for tests until the real one exists. It is deterministic: the same spec
 * and the same `salt` give the same bytes. Changing the salt stands for "the file came out
 * differently", for example because a fabric test changed the scale.
 */
export function fakeBuilder(salt = ""): PrintFileBuilder & { readonly built: PrintFileSpec[] } {
  const built: PrintFileSpec[] = [];
  return {
    built,
    async build(spec) {
      built.push(spec);
      const bytes = new TextEncoder().encode(`${salt}|${JSON.stringify(spec)}`);
      return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), pageWidthMm: 500, pageHeightMm: 700, warnings: [] };
    },
  };
}

export const PROFILE = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" } as const;

export const specFor = (pieceId: string, size = "48", playerNumber?: string): PrintFileSpec => ({
  pieceId,
  size,
  ...(playerNumber ? { playerNumber } : {}),
  format: "pdf",
  bleedMm: 15,
  scaleX: 1.0204,
  scaleY: 1.0152,
  dpi: 150,
  profile: PROFILE,
});
