import type { Route } from "next";
import Link from "next/link";

export interface JourneyStep {
  readonly label: string;
  /** Where the step is, or null when it cannot be reached from here. */
  readonly href: Route | null;
}

type JourneyStepsProps = Readonly<{ steps: readonly JourneyStep[]; current: number }>;

/**
 * The steps of the journey from a design to an order, as numbered pills. The step the page is
 * on is marked for screen readers too; steps before it read as behind the person.
 */
export function JourneySteps({ steps, current }: JourneyStepsProps) {
  return (
    <ol aria-label="Steps" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-tile p-1 text-[13px]">
      {steps.map((step, index) => {
        const text = `${index + 1} ${step.label}`;
        if (index === current) {
          return (
            <li key={step.label} aria-current="step" className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 font-medium text-canvas">
              {text}
            </li>
          );
        }
        const tone = index < current ? "text-cobalt-soft" : "text-faint";
        return (
          <li key={step.label} className="shrink-0">
            {step.href ? (
              <Link href={step.href} className={`nav-pill block rounded-full px-3.5 py-1.5 ${tone}`}>
                {text}
              </Link>
            ) : (
              <span className={`block px-3.5 py-1.5 ${tone}`}>{text}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
