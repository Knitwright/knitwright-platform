import type { SupabaseClient } from "@supabase/supabase-js";
import { getBlock, listBlocks } from "@/lib/pattern-library/service";
import type { BlockDetail } from "@/lib/pattern-library/records";
import { reviewLine } from "@/lib/pattern-library/review";
import { gradedPatternSchema, type GradedPattern } from "@/lib/production/contract";

export const NO_LIBRARY_PATTERN = "There is no pattern for this garment in your pattern library yet, so print files cannot be made. Add one in Patterns.";
export const PATTERN_NOT_FOUND = "That pattern could not be found, or it has no pieces, so print files cannot be made.";
export const PATTERN_CHANGED = "That pattern is not the version this was frozen with, so print files cannot be made from it.";

export type DesignPattern =
  | { readonly ok: true; readonly pattern: GradedPattern; readonly reviewed: boolean; readonly note: string }
  | { readonly ok: false; readonly reason: string };

/** The graded pattern in a stored block: every size that holds pieces, in the library's order. Null when none does. */
export function gradedFromDetail(detail: Pick<BlockDetail, "block" | "sizes">): GradedPattern | null {
  const sizes = [...detail.sizes].sort((a, b) => a.position - b.position).filter((entry) => entry.pieces.length > 0);
  const parsed = gradedPatternSchema.safeParse({
    blockId: detail.block.id,
    blockVersion: detail.block.version,
    sizes: sizes.map((entry) => entry.size),
    piecesBySize: Object.fromEntries(sizes.map((entry) => [entry.size, entry.pieces])),
  });
  return parsed.success ? parsed.data : null;
}

export interface PatternAsk {
  /** The design's garment type, which is the library's product key. */
  readonly typeId: string;
  /** A named pattern: a release is frozen with one. Without it the newest pattern for the garment is used. */
  readonly blockId?: string;
  readonly blockVersion?: number;
}

/**
 * The pattern the print files are cut from, read from the brand's pattern library with the person's own client. The
 * library holds one row per version, so a block id names one version exactly. The note is said in every file's margin.
 */
export async function loadDesignPattern(client: SupabaseClient, brandId: string, ask: PatternAsk): Promise<DesignPattern> {
  const blockId = ask.blockId ?? (await listBlocks(client, brandId)).find((block) => block.productKey === ask.typeId && block.kind === "pieces")?.id;
  if (blockId === undefined) return { ok: false, reason: NO_LIBRARY_PATTERN };
  const detail = await getBlock(client, brandId, blockId);
  if (!detail || detail.block.kind !== "pieces") return { ok: false, reason: ask.blockId === undefined ? NO_LIBRARY_PATTERN : PATTERN_NOT_FOUND };
  if (ask.blockVersion !== undefined && detail.block.version !== ask.blockVersion) return { ok: false, reason: PATTERN_CHANGED };
  const pattern = gradedFromDetail(detail);
  if (!pattern) return { ok: false, reason: PATTERN_NOT_FOUND };
  const review = detail.reviews[0] ?? null;
  return { ok: true, pattern, reviewed: review !== null, note: `Pattern: ${detail.block.name}, version ${detail.block.version}. ${reviewLine(review)}` };
}
