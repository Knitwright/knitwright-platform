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
      <ol className="flex flex-wrap gap-2">
        {GUIDED_STEPS.map((step, index) => {
          const isCurrent = step.id === current;
          const tone = isCurrent
            ? "bg-cobalt text-white"
            : index < at
              ? "bg-ok-wash text-ok"
              : "border border-hairline bg-surface text-ink-2";
          return (
            <li key={step.id}>
              <Link
                href={guideAddress(projectId, step.id, { unit }) as Route}
                aria-current={isCurrent ? "step" : undefined}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ${tone}`}
              >
                <span aria-hidden="true">{index + 1}</span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
