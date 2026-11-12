import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Finding } from "@/lib/production/contract";
import { fixHref, ruleOf } from "./fix";

const ACTORS: Readonly<Record<Finding["fix"]["whoActs"], string>> = {
  owner: "You",
  technician: "A pattern technician",
  "print-house": "Your print house",
  factory: "Your factory",
  club: "The club",
};

/** A finding as the route sends it: the contract's shape, with the rule id the checks attach. */
type ListedFinding = Finding & Readonly<{ ruleId?: string }>;

type Props = Readonly<{
  findings: readonly ListedFinding[];
  /** The design the findings are about, for the Fix links. Without one, the action is shown as text alone. */
  projectId?: string;
  /** The "Why?" link for a rule (`WhyLink` on the page; a double in tests). */
  why?: (ruleId: string, context: string) => ReactNode;
}>;

/**
 * The findings, blockers first. Each says what is wrong, what to do and who does it, with "Why?" (the rule) and
 * "Fix" (the screen that holds the control) beside it: spec F-0, "the UI lists each failing check with 'Why?' and
 * 'Fix' links" (plan v6 D1, decision 0132).
 */
export function FindingList({ findings, projectId, why }: Props) {
  if (findings.length === 0) return <p className="text-[13px] text-chalk-muted">Nothing is open against this factory profile.</p>;
  return (
    <ul className="flex flex-col gap-2" data-testid="validation-findings">
      {findings.map((f) => {
        const key = `${f.code}-${f.article ?? ""}-${f.panel ?? ""}`;
        const href = projectId === undefined ? null : fixHref(projectId, f.code);
        return (
          <li key={key} className="text-[14px] text-ink" data-testid={`finding-${f.code}`} data-severity={f.severity}>
            <span className="font-medium">{f.severity === "blocker" ? "Blocks ordering. " : "Worth knowing. "}</span>
            {f.message}
            <span className="block text-[13px] text-chalk-muted">{ACTORS[f.fix.whoActs]}: {f.fix.action}</span>
            <span className="mt-1 flex flex-wrap items-center gap-3 text-[13px]">
              {why ? why(ruleOf(f), `validation ${f.code}`) : null}
              {href === null ? null : (
                <Link href={href as Route} className="inline-flex min-h-10 items-center font-medium text-ink underline" data-testid="finding-fix">
                  Fix<span className="sr-only">: {f.fix.action}</span>
                </Link>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
