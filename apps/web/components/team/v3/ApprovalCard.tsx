import type { Route } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/ui/Chips";
import type { ApprovalSummary } from "@/lib/team/view";

/**
 * The committee card under the roster (d18): "Committee approval · Home kit", votes per version,
 * comments and when the link expires, with the approvals counted in a pill. It opens Approvals.
 */
export function ApprovalCard({ design, summary, href }: Readonly<{ design: string; summary: ApprovalSummary; href: Route }>) {
  return (
    <article className="relative flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-bg px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-title text-text">
          <Link href={href} className="no-underline after:absolute after:inset-0 after:content-['']">
            Committee approval · {design}
          </Link>
        </h3>
        <p className="text-body text-muted">{summary.line}</p>
      </div>
      {summary.locked ? <StatusPill tone="ok">Version locked</StatusPill> : summary.pill ? <StatusPill tone="info">{summary.pill}</StatusPill> : null}
    </article>
  );
}
