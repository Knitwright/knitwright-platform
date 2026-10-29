import type { ArticleDefinition } from "./article";
import type { DraftConstants } from "./constants";
import type { DraftOutcome, Finding, ResolvedInput } from "./types";

/** Why a valid request is not drawn: its geometry is not defined yet. */
export type Gate = Readonly<{ reason: string; ruleId: string | null }>;

/**
 * One base article's drafting script. It is given input that `resolveInput` has already accepted
 * and the article's drafting constants, which hold every number it draws with.
 */
export interface ArticleScript {
  readonly code: string;
  /** A reason to stop before drafting, for an option, parameter or constant the script does not draw. */
  gate(article: ArticleDefinition, input: ResolvedInput, constants: DraftConstants): Gate | null;
  draft(
    article: ArticleDefinition,
    size: string,
    input: ResolvedInput,
    constants: DraftConstants,
    warnings: readonly Finding[],
  ): DraftOutcome;
}
