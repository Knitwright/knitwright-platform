import { JOURNEY_STEPS, journeyIndex, type JourneyStepId } from "@/lib/home/journey";

/** The colours of each step's chip: the design in cobalt, the committee in amber, the quote in green. */
const CHIP: Readonly<Record<JourneyStepId, string>> = {
  design: "bg-cobalt-wash text-[#c9d2ff]",
  "factory-file": "bg-white/10 text-ink",
  committee: "bg-warn-wash text-warn",
  quote: "bg-ok-wash text-ok",
};

/**
 * Where a design is on its way to being made: a chip naming the step and four short bars, the
 * ones reached lit. Screen readers hear "Step 3 of 4: Committee".
 */
export function JourneySteps({ step }: Readonly<{ step: JourneyStepId }>) {
  const reached = journeyIndex(step);
  const label = JOURNEY_STEPS[reached]?.label ?? "";

  return (
    <span className="flex items-center gap-2.5">
      <span className={`rounded-full px-2.5 py-0.5 font-mono text-xs ${CHIP[step]}`}>
        <span className="sr-only">
          Step {reached + 1} of {JOURNEY_STEPS.length}:{" "}
        </span>
        {label}
      </span>
      <span className="flex gap-1" aria-hidden="true">
        {JOURNEY_STEPS.map((entry, index) => (
          <span
            key={entry.id}
            title={entry.label}
            className={`h-1 w-3 rounded-full ${index <= reached ? "bg-cobalt-soft" : "bg-white/12"}`}
          />
        ))}
      </span>
    </span>
  );
}
