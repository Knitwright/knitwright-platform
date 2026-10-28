/**
 * Timing harness for a full media run (decision 0059). It records how long each step takes against the stub providers.
 * The spec asks for "4 images and 1 clip in under 3 minutes". That cannot be measured until real provider keys exist,
 * because a stub answers at once, so the harness never compares a run with the target: it reports it as unmeasured.
 */

export const SPEC_TARGET = {
  statement: "4 images and 1 clip in under 3 minutes",
  limitSeconds: 180,
  status: "unmeasured",
} as const;

type RunStep = Readonly<{ name: string; ms: number }>;

type RunReport = Readonly<{
  providers: string;
  steps: readonly RunStep[];
  totalMs: number;
  /** Steps that could not run, with the reason. A skipped step is never counted as fast. */
  skipped: readonly string[];
  target: typeof SPEC_TARGET;
}>;

export function createStopwatch(now: () => number = () => performance.now()) {
  const marks: { name: string; at: number }[] = [];
  return {
    mark(name: string): void {
      marks.push({ name, at: now() });
    },
    report(providers: string, skipped: readonly string[]): RunReport {
      const steps = marks.slice(1).map((mark, i) => ({ name: mark.name, ms: Math.round(mark.at - (marks[i]?.at ?? mark.at)) }));
      return { providers, steps, totalMs: steps.reduce((sum, step) => sum + step.ms, 0), skipped, target: SPEC_TARGET };
    },
  };
}

/** The report in words, for the test log and the pull request. */
export function describeRun(report: RunReport): string {
  const lines = report.steps.map((step) => `  ${step.name}: ${step.ms} ms`);
  const skipped = report.skipped.map((reason) => `  ${reason}`);
  return [
    `Media run against ${report.providers} providers: ${report.totalMs} ms in all.`,
    ...lines,
    ...(skipped.length ? ["Not run:", ...skipped] : []),
    `Spec target "${report.target.statement}": ${report.target.status}. Stubs answer at once, so this run says nothing about real providers.`,
  ].join("\n");
}
