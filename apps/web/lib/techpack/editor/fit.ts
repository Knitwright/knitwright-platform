import type { BaseArticle } from "@/lib/catalogue";

/**
 * **Check fit** (spec screen 30, top right of the stage). It reads the graded size run the base
 * article gives and says, point by point, whether it holds together: a value at every size, a
 * linear point growing size on size, a fixed point staying put, and a tolerance on file.
 *
 * It measures nothing and works nothing out: every number is the article's. A point with no
 * tolerance is a question for the factory (plan v5 decision 18), never a default.
 */

export type FitState = "ok" | "attention";

export type FitLine = Readonly<{ letter: string; description: string; state: FitState; detail: string }>;

export type FitReport = Readonly<{
  lines: readonly FitLine[];
  /** How many points need attention. */
  attention: number;
  summary: string;
}>;

type Pom = BaseArticle["poms"][number];

function problemsOf(pom: Pom, sizes: readonly string[]): readonly string[] {
  const values = sizes.map((size) => pom.valuesMm[size]);
  const missing = sizes.filter((_, index) => values[index] === undefined);
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`no value at ${missing.join(", ")}`);
  const known = values.filter((value): value is number => value !== undefined);
  const steps = known.slice(1).map((value, index) => value - (known[index] as number));
  if (pom.gradeType === "linear" && steps.some((step) => step <= 0)) problems.push("does not grow size on size");
  if (pom.gradeType === "fixed" && steps.some((step) => step !== 0)) problems.push("changes across a fixed size run");
  if (!Number.isFinite(pom.tolMinusMm) || !Number.isFinite(pom.tolPlusMm)) problems.push("no tolerance on file; ask the factory");
  return problems;
}

const NO_ARTICLE = "This design is not on a base article the catalogue covers, so there is no size run to read.";
const NO_POINTS = "The base article has no points of measure on file yet.";

export function checkFit(article: Pick<BaseArticle, "poms" | "sizeRange" | "sampleSize"> | null, sizes: readonly string[] = []): FitReport {
  if (!article) return { lines: [], attention: 0, summary: NO_ARTICLE };
  if (article.poms.length === 0) return { lines: [], attention: 0, summary: NO_POINTS };
  const run = sizes.length > 0 ? sizes : article.sizeRange;
  const lines = article.poms.map((pom): FitLine => {
    const problems = problemsOf(pom, run);
    return problems.length === 0
      ? { letter: pom.letter, description: pom.description, state: "ok", detail: "Graded across the run, tolerance on file." }
      : { letter: pom.letter, description: pom.description, state: "attention", detail: problems.join("; ") };
  });
  const attention = lines.filter((line) => line.state === "attention").length;
  const range = run.length > 0 ? `${run[0]}–${run.at(-1)}` : "no sizes";
  const summary =
    attention === 0
      ? `All ${lines.length} points grade in order across ${range}, sample size ${article.sampleSize ?? "not on file"}.`
      : `${attention} of ${lines.length} points need attention across ${range}.`;
  return { lines, attention, summary };
}
