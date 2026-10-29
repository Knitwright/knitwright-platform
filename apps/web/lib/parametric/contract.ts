import { writeDxfAllSizes, writeDxfPerSize } from "@/lib/pattern-library/dxf/write";
import { gradedPatternSchema, patternPieceSchema, type GradedPattern, type LandmarkId, type PatternPiece, type Point } from "@/lib/production/contract";
import { bbox, type Pt } from "./geometry";
import { isFoldedRib, type ArticleDraft, type DraftPiece } from "./types";

/**
 * The drafted pieces as the production contract's pattern pieces. The contract uses the DXF frame
 * (mm, y UP), so every y is negated: body pieces keep the high shoulder point at the origin row and
 * the centre line at x = 0, the sleeve its cap top at the origin.
 */

const up = (p: Pt): Point => [p[0], p[1] === 0 ? 0 : -p[1]];

/** The grain line in the piece's own frame, where the review sheet draws it. */
function grainLine(piece: DraftPiece): { from: Point; to: Point } {
  const bb = bbox(piece.cutLine);
  const h = bb.y1 - bb.y0;
  if (isFoldedRib(piece)) return { from: up([bb.x0 + 30, bb.y0 + 4]), to: up([bb.x0 + 30, bb.y1 - 4]) };
  const x = bb.x0 + (bb.x1 - bb.x0) / 2;
  return { from: up([x, bb.y0 + h * 0.3]), to: up([x, bb.y0 + h * 0.8]) };
}

function landmarks(piece: DraftPiece): Partial<Record<LandmarkId, Point>> {
  return Object.fromEntries(Object.entries(piece.landmarks).map(([id, at]) => [id, up(at)]));
}

export function toPatternPiece(piece: DraftPiece, size: string): PatternPiece {
  return patternPieceSchema.parse({
    id: piece.id,
    name: piece.label,
    sizeLabel: size,
    quantity: piece.cut,
    mirroredPair: piece.mirroredPair,
    onFold: false,
    outlineKind: "with-seam-allowance",
    cutOutline: piece.cutLine.map(up),
    sewLine: piece.sewLine.map(up),
    notches: piece.notches.map((n) => ({ seamId: n.seamId, at: up(n.slit[0]), count: 1 })),
    seamAllowance: piece.seamAllowance.map((a) => ({ seamId: a.seamId, mm: a.mm, source: "knitwright-default" })),
    grainLine: grainLine(piece),
    foldLine: null,
    internalLines: [],
    landmarks: landmarks(piece),
  });
}

/** Every size of one article as a graded pattern. `blockVersion` is the platform's version of the block. */
export function toGradedPattern(drafts: readonly ArticleDraft[], blockVersion: number): GradedPattern {
  return gradedPatternSchema.parse({
    blockId: drafts[0].articleCode,
    blockVersion,
    sizes: drafts.map((d) => d.size),
    piecesBySize: Object.fromEntries(drafts.map((d) => [d.size, d.pieces.map((p) => toPatternPiece(p, d.size))])),
  });
}

const STATUS = "Draft for factory review, not reviewed.";

/** AAMA-style DXF per size and one with every size, through the pattern library's writer. */
export function productionDxf(pattern: GradedPattern): { perSize: Record<string, string>; allSizes: string } {
  const options = { styleName: pattern.blockId, status: STATUS };
  return { perSize: writeDxfPerSize(pattern, options), allSizes: writeDxfAllSizes(pattern, options) };
}
