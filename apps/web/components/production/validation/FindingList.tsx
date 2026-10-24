import type { Finding } from "@/lib/production/contract";

const ACTORS: Readonly<Record<Finding["fix"]["whoActs"], string>> = {
  owner: "You",
  technician: "A pattern technician",
  "print-house": "Your print house",
  factory: "Your factory",
  club: "The club",
};

/** The findings, blockers first. Each says what is wrong, what to do and who does it. */
export function FindingList({ findings }: Readonly<{ findings: readonly Finding[] }>) {
  if (findings.length === 0) return <p className="text-[13px] text-chalk-muted">Nothing is open against this factory profile.</p>;
  return (
    <ul className="flex flex-col gap-2" data-testid="validation-findings">
      {findings.map((f) => (
        <li key={`${f.code}-${f.article ?? ""}-${f.panel ?? ""}`} className="text-[14px] text-ink" data-testid={`finding-${f.code}`} data-severity={f.severity}>
          <span className="font-medium">{f.severity === "blocker" ? "Blocks ordering. " : "Worth knowing. "}</span>
          {f.message}
          <span className="block text-[13px] text-chalk-muted">{ACTORS[f.fix.whoActs]}: {f.fix.action}</span>
        </li>
      ))}
    </ul>
  );
}
