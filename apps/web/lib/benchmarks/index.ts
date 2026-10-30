/** Benchmarks: compare products (plans/platform-v5.md Z3, spec F-S2, decision 0084). */
export { applyPlan, NEVER_CARRIED, NOT_AVAILABLE, type ApplyPlan, type MappedFeature, type UnsupportedFeature } from "./apply";
export { cardClaims, cardFeatures, cardFields, cardThemes, line, NOT_KNOWN, PROVENANCE_LABELS, PROVENANCE_MARKS, THEMES_NOTE, type FeatureView, type FieldView } from "./card";
export { compareView, GRAPHICS_NOTE, TOO_FEW, TOO_MANY, type CompareView, type MatrixRow, type StoredCard, type ThemeRow } from "./compare";
export { applyCorrection, correctionSchema, minorUnitsOf, type Correction } from "./corrections";
export { designAround, type DesignAroundReport, type DesignShape } from "./design-around";
export { createStubExtractor, type BenchmarkExtractor, type ExtractInput } from "./extract";
export { fetchProductPage, normaliseUrl, REFUSALS, urlKey, type Fetcher, type PageWords } from "./fetch";
export { BENCHMARK_LIMITS, TOO_MANY_FETCHES } from "./limits";
export { cardFrom, functionalFeatures, withoutCopies } from "./normalise";
export { parseRobots, pathAllowed, robotsAllows } from "./robots";
export { benchmarkCardSchema, emptyCard, MAX_CARDS, MIN_COMPARE, type BenchmarkCard } from "./schema";
export { hasMarkup, isParaphrase, plain } from "./scrub";
export { addCardFromPhoto, addCardFromReviewText, addCardFromUrl, markCorrected, type IntakeResult, type ServiceDeps } from "./service";
export { createSupabaseStore, type BenchmarkDetail, type BenchmarkStore, type BenchmarkSummary, type Who } from "./store";
export * from "./vocabulary";
