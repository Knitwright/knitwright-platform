import { draftAllSizes, type DraftSources, type GradedOutcome } from "../registry";
import type { DraftInput } from "../types";
import { nestDxf, reviewDxf } from "./dxf";
import { nestLayout, nestSvg } from "./nest";
import { patternReport } from "./report";
import { reviewSvg } from "./svg";

export { DXF_LAYERS, nestDxf, reviewDxf } from "./dxf";
export { nestLayout, nestSvg } from "./nest";
export { patternReport } from "./report";
export { reviewSvg } from "./svg";

export type ReviewPack =
  | Exclude<GradedOutcome, { kind: "drafted" }>
  | Readonly<{ kind: "drafted"; files: Readonly<Record<string, string>> }>;

/**
 * The factory review files of `docs/spec/articles/<code>/pattern`: per size a DXF and an SVG, the
 * graded nest as SVG and DXF, and the pattern report. File names are fixed; the content depends
 * only on the article and the input, so the same request gives the same bytes.
 */
export function reviewPack(code: string, input: DraftInput = {}, sources: DraftSources = {}): ReviewPack {
  const graded = draftAllSizes(code, input, sources);
  if (graded.kind !== "drafted") return graded;
  const { article } = graded;
  const nest = nestLayout(graded.drafts, article.base_size);
  const files: Record<string, string> = {};
  for (const draft of graded.drafts) {
    files[`${code}_${draft.size}.dxf`] = reviewDxf(draft);
    files[`${code}_${draft.size}.svg`] = reviewSvg(draft);
  }
  files[`${code}_nest.svg`] = nestSvg(nest);
  files[`${code}_nest.dxf`] = nestDxf(nest);
  files["pattern-report.md"] = patternReport(article, graded.drafts);
  return { kind: "drafted", files };
}
