import type { ArticleRef } from "@/lib/garment/spec-schema";

/**
 * The two things validation reads from workstreams that are built beside it (plan v5 Lessons 9). Each is the smallest
 * interface validation needs. The base article catalogue (X1) and moderation (X8) provide real ones in wave 2; until
 * then the unwired versions below say "nothing known", which raises no finding about parameters or moderation.
 */

/** One structural parameter of a base article, as the catalogue approves it. */
export type ParameterDef =
  | Readonly<{ key: string; type: "range"; min: number; max: number; step: number | null; ruleId: string | null }>
  | Readonly<{ key: string; type: "enum"; values: readonly string[]; ruleId: string | null }>
  | Readonly<{ key: string; type: "bool"; ruleId: string | null }>;

/** What validation needs from the base article catalogue. */
export interface ArticleCatalogue {
  /** The base article a garment type maps to, with no parameters chosen, or null when none is mapped yet. */
  readonly articleForType: (typeId: string) => Promise<Omit<ArticleRef, "parameters"> | null>;
  /** The approved parameters of an article, or null when the catalogue does not offer that article. */
  readonly parameterDefs: (baseArticleCode: string) => Promise<readonly ParameterDef[] | null>;
}

export const MODERATION_RESULTS = ["pending", "clear", "flagged", "blocked"] as const;
export type ModerationResult = (typeof MODERATION_RESULTS)[number];

/** Something a design uses that moderation screens: an uploaded asset, or the design's text. */
export interface ModerationTarget {
  readonly kind: "asset" | "text";
  readonly id: string;
  /** Plain words for the person, such as "Club crest". */
  readonly label: string;
}

export interface ModerationStatus {
  readonly target: ModerationTarget;
  readonly result: ModerationResult;
}

/** What validation needs from moderation: the latest result for each target. A target with no result is left out. */
export interface ModerationReader {
  readonly statusesFor: (brandId: string, targets: readonly ModerationTarget[]) => Promise<readonly ModerationStatus[]>;
}

/** Until X1 is wired: no garment type maps to a base article, and no article is offered. */
export const UNWIRED_CATALOGUE: ArticleCatalogue = {
  articleForType: async () => null,
  parameterDefs: async () => null,
};

/** Until X8 is wired: nothing has been screened. */
export const UNWIRED_MODERATION: ModerationReader = {
  statusesFor: async () => [],
};

export interface ValidationPorts {
  readonly catalogue: ArticleCatalogue;
  readonly moderation: ModerationReader;
}

export const UNWIRED_PORTS: ValidationPorts = { catalogue: UNWIRED_CATALOGUE, moderation: UNWIRED_MODERATION };
