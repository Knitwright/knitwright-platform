import { baseArticleForType } from "@/lib/catalogue/registry-map";
import { dxfForSize, nestDxf, patternSvg, pdf1to1, type PatternFileOptions } from "@/lib/kpp/files/patterns";
import { draftedPattern } from "@/lib/kpp/sources/pattern";
import type { Batch, OpsOrder } from "@/lib/ops/rows";
import type { GradedPattern } from "@/lib/production/contract";
import type { PatternFile, PatternSet, PatternSource } from "./patterns";

/**
 * Seam 4 of the wave 2 wiring: the factory's `patterns/` folder, from the production package's own pattern
 * writers (X5, decision 0070) over the graded drafter (X3, decision 0068). A batch names a garment registry
 * type, which the catalogue maps to a base article (decision 0066); that article is drafted in every size the
 * batch's orders ask for, and written as DXF-AAMA, a 1:1 PDF and an SVG per size, plus one nested DXF.
 *
 * Nothing is guessed. Where the type maps to no article, the article has no drafting script, or the orders ask
 * for a size the article does not grade, there is no file for it and the README says why in plain words.
 */

const SENT_SEPARATELY = "Knitwright sends the pattern files for this batch separately.";

/** Owner decision 17: one notch style in the DXF for now, and the files say which it is. */
const NOTCH = "v-notch";

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

const nothing = (note: string): PatternSet => ({ files: [], note: `${note} ${SENT_SEPARATELY}` });

/** The sizes the batch's orders ask for, each one once. */
const asked = (orders: readonly OpsOrder[]): readonly string[] => [
  ...new Set(orders.flatMap((order) => Object.entries(order.sizes).filter(([, pieces]) => pieces > 0).map(([size]) => size))),
];

/** What the README says about a folder that does hold patterns. */
function drawnWith(code: string, articleVersion: string, blockVersion: number, missing: readonly string[]): string {
  return [
    `patterns/: the graded block of base article ${code}, as DXF-AAMA, a 1:1 PDF and an SVG per size, with one nested DXF.`,
    `Drafted from ${code} version ${articleVersion} (block v${blockVersion}) at the article's own default parameters, with ${NOTCH} notches.`,
    "It is a Knitwright draft for factory review, not a factory-checked master pattern.",
    missing.length > 0 ? `No pattern for size ${[...missing].sort().join(", ")}: the article does not grade that size.` : null,
  ]
    .filter((line) => line !== null)
    .join(" ");
}

/** The files of one size, named as the production package names them, without its folder numbers. */
const filesForSize = (pieces: GradedPattern["piecesBySize"][string], code: string, size: string, options: PatternFileOptions): PatternFile[] => [
  { path: `dxf_aama/${code}_${size}.dxf`, bytes: utf8(dxfForSize(pieces, options)) },
  { path: `pdf_1to1/${code}_${size}.pdf`, bytes: pdf1to1(pieces, options) },
  { path: `svg/${code}_${size}.svg`, bytes: utf8(patternSvg(pieces, options)) },
];

/** Every asked-for size the article grades, in grading order, and the nest of exactly those sizes. */
function filesOf(pattern: GradedPattern, code: string, sizes: readonly string[], options: PatternFileOptions): PatternFile[] {
  const perSize = sizes.flatMap((size) => filesForSize(pattern.piecesBySize[size]!, code, size, options));
  const nest: GradedPattern = { ...pattern, sizes: [...sizes], piecesBySize: Object.fromEntries(sizes.map((size) => [size, pattern.piecesBySize[size]!])) };
  return [...perSize, { path: `dxf_aama/${code}_nest.dxf`, bytes: utf8(nestDxf(nest, options)) }];
}

/**
 * The pattern files of one batch. The same batch and orders give the same bytes: the drafter reads no clock,
 * and every file's date is the batch's cut-off.
 */
export function patternsFor(batch: Batch, orders: readonly OpsOrder[]): PatternSet {
  const code = baseArticleForType(batch.articleId);
  if (code === undefined) return nothing(`No patterns: ${batch.articleId} is not mapped to a base article in the catalogue, so nothing has been drafted for it.`);
  const drafted = draftedPattern(code);
  if (!drafted.ok) return nothing(`No patterns for base article ${code}: ${drafted.reason}`);
  const wanted = asked(orders);
  if (wanted.length === 0) return nothing(`No patterns: no order in this batch asks for a size, so no size of ${code} was drafted.`);
  const sizes = drafted.pattern.sizes.filter((size) => wanted.includes(size));
  const missing = wanted.filter((size) => !drafted.pattern.sizes.includes(size));
  if (sizes.length === 0) return nothing(`No patterns for base article ${code}: it does not grade size ${[...missing].sort().join(", ")}.`);
  const options: PatternFileOptions = {
    article: code,
    styleName: code,
    notch: NOTCH,
    status: `Knitwright draft for factory review, not reviewed: ${code} v${drafted.articleVersion}, graded block v${drafted.pattern.blockVersion}`,
    createdIso: batch.cutoffAt,
  };
  return { files: filesOf(drafted.pattern, code, sizes, options), note: drawnWith(code, drafted.articleVersion, drafted.pattern.blockVersion, missing) };
}

/** The source the factory's ZIP uses. */
export const draftedPatterns: PatternSource = { filesFor: async (batch, orders) => patternsFor(batch, orders) };
