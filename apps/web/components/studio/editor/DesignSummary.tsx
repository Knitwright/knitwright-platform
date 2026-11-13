"use client";

import { Grid3x3, ImagePlus, Layers, PaintBucket, Scissors, Tag, Type, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import type { SummaryRow, SummarySection, SummarySectionId } from "@/lib/editor";
import { WhyButton } from "./WhyButton";

const GLYPHS: Readonly<Record<SummarySectionId, LucideIcon>> = {
  fabrics: Layers,
  colours: PaintBucket,
  "pattern-fills": Grid3x3,
  graphics: ImagePlus,
  "names-numbers": Type,
  "trims-labels": Tag,
  stitches: Scissors,
};

type Props = Readonly<{ sections: readonly SummarySection[]; onOpen: (section: SummarySectionId) => void }>;

/**
 * The Design summary (spec F-S4; in Garment Studio's right-hand panel, `08` v3.6, s02). Each group
 * lists the parts in use with a swatch, the part and its spec, and says "No … yet" when empty. Every
 * row of an editable group is a button that opens that group's editor without leaving the design;
 * the shell decides whether that editor is a tool of the Form toolbar or a panel here
 * (`SidePanel.tsx`). Stitches are read from the base article's construction table and cannot be
 * edited; each carries the rule behind it.
 */
export function DesignSummary({ sections, onOpen }: Props) {
  return (
    <section aria-label="Design summary" data-testid="design-summary" className="-mx-4 -mt-4 flex min-h-0 flex-col overflow-y-auto">
      <h2 className="border-b border-border px-5 py-5 text-h3 text-text">Design summary</h2>
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1 border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2.5 pb-1 text-small font-semibold tracking-[0.04em] text-text uppercase">
            <Icon icon={GLYPHS[section.id]} size={20} />
            {section.label}
            {section.readOnly ? <span className="font-medium tracking-normal text-muted normal-case">{" (from base)"}</span> : null}
          </h3>
          {section.rows.length === 0 ? (
            /* An editable group with nothing in it yet still opens its editor: otherwise the Names &
               numbers panel could only be opened by a design that already had them. */
            section.opens ? (
              <button
                type="button"
                onClick={() => onOpen(section.id)}
                data-testid={`summary-empty-${section.id}`}
                className="flex min-h-10 items-center rounded-md px-1 text-left text-small text-muted live:hover:bg-soft"
              >
                {section.empty} <span className="ml-1 font-semibold text-link">Open</span>
              </button>
            ) : (
              <p className="text-small text-muted">{section.empty}</p>
            )
          ) : (
            <ul className="flex flex-col">
              {section.rows.map((row) => (
                <li key={row.id} className="flex items-center gap-1">
                  {section.opens ? (
                    <button type="button" onClick={() => onOpen(section.id)} className="flex min-h-11 flex-1 items-center gap-2.5 rounded-md px-1 text-left live:hover:bg-soft">
                      <RowBody row={row} />
                    </button>
                  ) : (
                    <span className="flex min-h-11 flex-1 items-center gap-2.5 px-1">
                      <RowBody row={row} />
                    </span>
                  )}
                  {row.ruleId ? <WhyButton ruleId={row.ruleId} context={`summary ${section.id} ${row.id}`} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

/** A row: its swatch (the screen colour where there is one), the part, and what it is. */
function RowBody({ row }: Readonly<{ row: SummaryRow }>) {
  return (
    <>
      <span aria-hidden="true" className="size-7.5 shrink-0 rounded-sm border border-border bg-soft" style={row.swatch ? { backgroundColor: row.swatch } : undefined} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-small font-semibold text-text">{row.label}</span>
        {row.detail ? <span className="truncate text-caption text-muted">{row.detail}</span> : null}
      </span>
    </>
  );
}
