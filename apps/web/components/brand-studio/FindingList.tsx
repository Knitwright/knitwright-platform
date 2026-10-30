import type { BrandFinding } from "@/lib/brand-studio/words";

/**
 * The findings of a tab, each with the rule that explains it (spec decision 11). A finding whose
 * rule has no rulebook entry carries `R-GAP-000` and says so, so nothing reads as a settled fact.
 */
export function FindingList({ findings, title }: Readonly<{ findings: readonly BrandFinding[]; title: string }>) {
  if (findings.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">{title}</p>
      <ul className="flex flex-col gap-2" data-testid="brand-findings">
        {findings.map((finding, at) => (
          <li
            key={`${finding.code}-${finding.subject}-${at}`}
            className={`rounded-xl border px-3 py-2 text-[13px] leading-relaxed ${
              finding.severity === "warning" ? "border-warn/30 bg-warn-wash text-warn" : "border-hairline text-muted"
            }`}
          >
            <span className="block">{finding.message}</span>
            <span className="mt-1 block text-muted">{finding.fix}</span>
            <span className="mt-1 block font-mono text-[11px] text-faint">
              {finding.ruleId === "R-GAP-000" ? `${finding.ruleId} · no rulebook entry for this yet` : finding.ruleId}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
