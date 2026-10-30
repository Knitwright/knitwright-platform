"use client";

import type { SummarySection } from "@/lib/editor";
import type { ToolId } from "@/lib/workspace/tools";
import { WhyButton } from "./WhyButton";

type Props = Readonly<{ sections: readonly SummarySection[]; onOpen: (tool: ToolId) => void }>;

/**
 * The right-hand Design Summary (spec F-S4). Every row of an editable section is a button that
 * opens that row's editor in the shell's own panel, so nothing takes the person off the design.
 * The Stitches section is read from the base article's construction table and cannot be edited
 * here; each of its rows carries the rule behind it.
 */
export function DesignSummary({ sections, onOpen }: Props) {
  return (
    <section aria-label="Design summary" data-testid="design-summary" className="glass flex min-h-0 flex-col overflow-y-auto rounded-3xl p-4">
      <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Design summary</h2>
      <div className="mt-3 flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-1 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
            <h3 className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
              {section.label}
              {section.readOnly ? <span className="text-chalk-muted"> (from base)</span> : null}
            </h3>
            {section.rows.length === 0 ? (
              <p className="text-[13px] text-chalk-muted">{section.empty}</p>
            ) : (
              <ul className="flex flex-col">
                {section.rows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-1">
                    {section.opens ? (
                      <button
                        type="button"
                        onClick={() => onOpen(section.opens as ToolId)}
                        className="flex min-h-10 flex-1 flex-col items-start justify-center rounded-lg px-1 text-left hover:bg-tile-2"
                      >
                        <span className="text-[13px] text-ink">{row.label}</span>
                        {row.detail ? <span className="text-[11px] text-chalk-muted">{row.detail}</span> : null}
                      </button>
                    ) : (
                      <span className="flex min-h-10 flex-1 flex-col justify-center px-1">
                        <span className="text-[13px] text-ink">{row.label}</span>
                        {row.detail ? <span className="text-[11px] text-chalk-muted">{row.detail}</span> : null}
                      </span>
                    )}
                    {row.ruleId ? <WhyButton ruleId={row.ruleId} context={`summary ${section.id} ${row.id}`} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
