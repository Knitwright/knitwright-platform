import sharp from "sharp";
import { createAssetReader } from "@/lib/artwork-intake";
import { createFakeAdmin, type FakeAdmin } from "@/lib/artwork-intake/fixtures/fake-admin";
import { uploadArtwork } from "@/lib/artwork-intake/service";
import type { ArtworkStack, AssetReader } from "@/lib/artwork-stack";
import type { GradedPattern, PrintFileSpec, PrintProfile } from "@/lib/production/contract";
import { createPrintFileBuilder, type BuilderDeps } from "../build/file-builder";
import { loadDesignPattern } from "../inputs/pattern";
import { BLOCK_ID, BRAND, blockRow, libraryClient, sizeRows } from "./library-client";
import { NO_RULES } from "./setup";

/** The real inputs, with only the database and the storage bucket in memory: W7b's intake and reader, W1's pattern library. */
export const USER = "22222222-2222-4222-8222-222222222222";
export const NOW = new Date("2026-10-14T10:00:00Z");

export const PROFILE: PrintProfile = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" };

export interface RealWorld {
  readonly fake: FakeAdmin;
  readonly assets: AssetReader;
  readonly pattern: GradedPattern;
  upload(bytes: Uint8Array, fileName: string): Promise<string>;
  builder(stack: ArtworkStack, over?: Partial<BuilderDeps>): ReturnType<typeof createPrintFileBuilder>;
}

export async function realWorld(): Promise<RealWorld> {
  const fake = createFakeAdmin();
  const library = libraryClient({ pattern_blocks: [blockRow()], pattern_block_sizes: sizeRows(), pattern_reviews: [] });
  const found = await loadDesignPattern(library, BRAND, { typeId: "team-jersey", blockId: BLOCK_ID });
  if (!found.ok) throw new Error(found.reason);
  const assets = createAssetReader(fake.admin, BRAND);
  return {
    fake,
    assets,
    pattern: found.pattern,
    upload: async (bytes, fileName) => (await uploadArtwork(fake.admin, { brandId: BRAND, userId: USER }, { bytes, fileName, rightsConfirmed: true, now: NOW })).id,
    builder: (stack, over = {}) =>
      createPrintFileBuilder({
        pattern: found.pattern,
        stack,
        colourwayId: "main",
        assets,
        rules: NO_RULES,
        roster: null,
        garment: "team-jersey",
        minDpi: 150,
        scaleNote: "Not scaled for shrink: this fabric has no shrink test.",
        defaultsNote: "Bleed and resolution are Knitwright defaults, not from your print house.",
        patternReviewed: false,
        ...over,
      }),
  };
}

export const specOf = (pieceId: string, size: string, format: PrintFileSpec["format"], extra: Partial<PrintFileSpec> = {}): PrintFileSpec => ({
  pieceId,
  size,
  format,
  bleedMm: 15,
  scaleX: 1,
  scaleY: 1,
  dpi: 150,
  profile: PROFILE,
  ...extra,
});

/** A test card: a checker of 100 px cells in two pale greys, and a black square at four known places (as fractions of the card). */
export const FIDUCIALS = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]] as const;

export async function testCard(widthPx: number, heightPx: number): Promise<Uint8Array> {
  const mark = Math.round(widthPx / 40);
  const squares = FIDUCIALS.map(([fx, fy]) => `<rect x="${Math.round(fx * widthPx - mark / 2)}" y="${Math.round(fy * heightPx - mark / 2)}" width="${mark}" height="${mark}" fill="#000000"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}"><defs><pattern id="c" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" fill="#eeeeee"/><rect width="100" height="100" fill="#cccccc"/><rect x="100" y="100" width="100" height="100" fill="#cccccc"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/>${squares}</svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}
