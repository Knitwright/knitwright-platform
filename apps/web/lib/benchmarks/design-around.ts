import type { BenchmarkCard } from "./schema";
import { featureOf, RULE_GAP, type LayoutKind, type LayoutZone } from "./vocabulary";

/**
 * The design-around check (spec F-S2 guardrails, F-G1): where a design is linked to a benchmark, how close its
 * silhouette and its surface layout have come to that benchmark's. It warns; it never blocks, and it never says a
 * design is safe or unsafe — that is not something this check can know, and saying it would be the settled-sounding
 * claim the wording rules exist to stop. Every finding carries a rule id; the rulebook has no entry for this yet, so
 * it is `R-GAP-000` and the PR lists it.
 */

/** The design, as this check reads it: the silhouette features it has chosen and where its own artwork sits. */
export type DesignShape = Readonly<{
  /** Feature keys of Knitwright's taxonomy the design has chosen (from its options and parameters). */
  features: readonly string[];
  layout: readonly Readonly<{ zone: LayoutZone; kind: LayoutKind }>[];
}>;

export type Closeness = "far" | "close";

export type DesignAroundFinding = Readonly<{
  code: "silhouette_close" | "layout_close";
  severity: "warn";
  message: string;
  ruleId: string;
  /** What the two have in common, in Knitwright's words. Never the benchmark's own words. */
  shared: readonly string[];
}>;

export type DesignAroundReport = Readonly<{
  closeness: Closeness;
  findings: readonly DesignAroundFinding[];
  silhouetteShared: number;
  layoutShared: number;
}>;

/** Three silhouette features in common, with nothing chosen differently, is where we start warning. A draft number. */
export const SILHOUETTE_WARN_AT = 3;
/** Three surface places in common, and most of the benchmark's places matched. Also a draft number. */
export const LAYOUT_WARN_AT = 3;
export const LAYOUT_WARN_SHARE = 0.7;

const silhouetteOf = (card: BenchmarkCard): readonly string[] =>
  card.features.filter((found) => featureOf(found.key)?.kind === "functional").map((found) => found.key);

const shared = <T>(mine: readonly T[], theirs: readonly T[]): readonly T[] => theirs.filter((item) => mine.includes(item));

const layoutKeys = (layout: readonly Readonly<{ zone: LayoutZone; kind: LayoutKind }>[]): readonly string[] =>
  layout.map((item) => `${item.zone}:${item.kind}`);

const label = (key: string): string => featureOf(key)?.label ?? key;

export function designAround(design: DesignShape, card: BenchmarkCard): DesignAroundReport {
  const sameFeatures = shared(design.features, silhouetteOf(card));
  const theirLayout = layoutKeys(card.surfaceLayout);
  const sameLayout = shared(layoutKeys(design.layout), theirLayout);
  const findings: DesignAroundFinding[] = [];
  if (sameFeatures.length >= SILHOUETTE_WARN_AT) {
    findings.push({
      code: "silhouette_close",
      severity: "warn",
      message: `This design shares ${sameFeatures.length} silhouette choices with the benchmark. Change one of them, or say in the brief why the shape has to be this one.`,
      ruleId: RULE_GAP,
      shared: sameFeatures.map(label),
    });
  }
  if (sameLayout.length >= LAYOUT_WARN_AT && theirLayout.length > 0 && sameLayout.length / theirLayout.length >= LAYOUT_WARN_SHARE) {
    findings.push({
      code: "layout_close",
      severity: "warn",
      message: `Your artwork sits in the same ${sameLayout.length} places as the benchmark's. Move or drop one, so the layout is your own.`,
      ruleId: RULE_GAP,
      shared: sameLayout,
    });
  }
  return { closeness: findings.length > 0 ? "close" : "far", findings, silhouetteShared: sameFeatures.length, layoutShared: sameLayout.length };
}
