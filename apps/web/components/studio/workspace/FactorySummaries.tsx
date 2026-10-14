import type { Route } from "next";
import Link from "next/link";
import type { GarmentSpec } from "@/lib/garment";
import { fabricSummary, labellingSummary, trimSummary, type Fact } from "@/lib/workspace/summaries";

type SummaryProps = Readonly<{ projectId: string; spec: GarmentSpec }>;

const factoryFile = (projectId: string, section: string): Route =>
  `/studio/${encodeURIComponent(projectId)}/tech-pack#${section}` as Route;

/** Where the details are typed: the factory file, which keeps them with their source. */
function FillInLink({ href, children }: Readonly<{ href: Route; children: string }>) {
  return (
    <p className="text-sm text-muted">
      <Link href={href} className="font-medium text-cobalt-soft underline-offset-4 hover:underline">
        {children}
      </Link>
    </p>
  );
}

function FactList({ facts, label }: Readonly<{ facts: readonly Fact[]; label: string }>) {
  return (
    <dl aria-label={label} className="flex flex-col divide-y divide-white/10 rounded-2xl bg-white/[0.04] px-4">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
          <dt className="text-ink-2">{fact.label}</dt>
          <dd className="text-right font-mono text-xs text-chalk-muted">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The fabric of each part, read from the design. */
export function FabricSummary({ projectId, spec }: SummaryProps) {
  return (
    <>
      <ul className="flex flex-col gap-3">
        {fabricSummary(spec).map((card) => (
          <li key={card.id} className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-ink">{card.title}</p>
            <p className="text-sm text-muted">{card.parts}</p>
            <FactList facts={card.facts} label={card.title} />
          </li>
        ))}
      </ul>
      <FillInLink href={factoryFile(projectId, "components")}>Describe the fabrics in the factory file</FillInLink>
    </>
  );
}

/** Thread, labels, rib and trims, read from the design. */
export function TrimSummary({ projectId, spec }: SummaryProps) {
  const rows = trimSummary(spec);
  if (rows.length === 0) return <p className="text-sm text-muted">This garment lists no trims.</p>;
  return (
    <>
      <FactList facts={rows} label="Trims" />
      <FillInLink href={factoryFile(projectId, "components")}>Describe the trims in the factory file</FillInLink>
    </>
  );
}

/** Care, composition and origin labels, the fold and the bag, read from the design. */
export function LabellingSummary({ projectId, spec }: SummaryProps) {
  return (
    <>
      <FactList facts={labellingSummary(spec)} label="Labelling" />
      <FillInLink href={factoryFile(projectId, "labelling")}>Write the labels in the factory file</FillInLink>
    </>
  );
}
