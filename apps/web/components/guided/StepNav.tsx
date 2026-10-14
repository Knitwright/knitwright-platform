import type { Route } from "next";
import Link from "next/link";
import { GUIDED_STEPS, STEP_IDS, guideAddress, type StepId } from "@/lib/guided/flow";
import type { LengthUnit } from "@/lib/units/length";

type Props = Readonly<{ projectId: string; current: StepId; unit: LengthUnit }>;

/** The four steps, in order. The current one is marked for screen readers as well as by sight. */
export function StepNav({ projectId, current, unit }: Props) {
  const at = STEP_IDS.indexOf(current);
  return (
    <nav aria-label="Steps">
      <ol className="flex flex-wrap gap-1 rounded-[1.25rem] bg-tile p-1 lg:rounded-full">
        {GUIDED_STEPS.map((step, index) => {
          const isCurrent = step.id === current;
          const tone = isCurrent ? "bg-chalk font-medium text-[#0b0c0e]" : index < at ? "nav-pill text-ok" : "nav-pill text-chalk-muted";
          return (
            <li key={step.id}>
              <Link
                href={guideAddress(projectId, step.id, { unit }) as Route}
                aria-current={isCurrent ? "step" : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] ${tone}`}
              >
                <span aria-hidden="true" className="font-mono">
                  {index + 1}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
