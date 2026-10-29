import type { WhyView } from "@/lib/rulebook/view";

/**
 * The words inside a "Why?" popover: the rule as written in the rulebook, why, the best practice, where it came from
 * and whether the factory has confirmed it. An id with no entry shows the gap text only. `headingId` labels the popover.
 */
export function WhyCard({ view, headingId }: Readonly<{ view: WhyView; headingId: string }>) {
  if (view.kind === "gap") {
    return (
      <div className="flex flex-col gap-2" data-testid="why-gap">
        <p id={headingId} className="font-mono text-xs uppercase tracking-wider text-muted">{view.ruleId}</p>
        <p className="text-[15px] text-ink">{view.text}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="why-rule">
      <p id={headingId} className="font-semibold text-ink">
        <span className="font-mono text-xs uppercase tracking-wider text-muted">Rulebook {view.ruleId}</span>{" "}
        <span>{view.title}</span>
      </p>
      <p className="text-[15px] text-ink"><strong className="font-medium">Rule:</strong> {view.rule}</p>
      <p className="text-[15px] text-ink"><strong className="font-medium">Why:</strong> {view.body}</p>
      {view.bestPractice ? <p className="text-[15px] text-ink"><strong className="font-medium">Best practice:</strong> {view.bestPractice}</p> : null}
      <p className="text-sm text-muted">Source: {view.source}</p>
      <p className={`text-sm ${view.draft ? "text-warn" : "text-ink-2"}`} data-testid="why-status">{view.status} (version {view.version})</p>
    </div>
  );
}
