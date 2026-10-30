"use client";

import type { TabSection, TabView, ViewTable } from "@/lib/techpack/view";
import { CellValue } from "./Chips";

/**
 * The ten content tabs, drawn from the one shape they all have (`lib/techpack/view/rows.ts`): a
 * list of fields, then tables of them. The Measurements tab and the Review tab have their own
 * components, because their shapes are their own.
 */

export function TabSections({ view }: Readonly<{ view: TabView }>) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-chalk-muted">{view.lead}</p>
      {view.sections.map((part) => (
        <Section key={part.id} tabId={view.id} part={part} />
      ))}
    </div>
  );
}

function Section({ tabId, part }: Readonly<{ tabId: string; part: TabSection }>) {
  return (
    <section aria-labelledby={`techpack-${tabId}-${part.id}`} className="flex flex-col gap-2" data-testid={`techpack-section-${part.id}`}>
      <h4 id={`techpack-${tabId}-${part.id}`} className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">
        {part.title}
      </h4>
      {part.note ? <p className="text-[13px] leading-relaxed text-warn">{part.note}</p> : null}
      {part.fields.length > 0 ? (
        <dl className="flex flex-col gap-2">
          {part.fields.map((cell) => (
            <div key={cell.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="min-w-44 text-[11px] text-chalk-muted">{cell.label}</dt>
              <dd className="min-w-0 flex-1">
                <CellValue cell={cell} context={`techpack ${tabId}`} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {part.tables.map((entry) => (
        <Table key={entry.id} tabId={tabId} entry={entry} />
      ))}
    </section>
  );
}

function Table({ tabId, entry }: Readonly<{ tabId: string; entry: ViewTable }>) {
  return (
    <div className="flex flex-col gap-1" data-testid={`techpack-table-${entry.id}`}>
      {entry.note ? <p className="text-[11px] leading-relaxed text-warn">{entry.note}</p> : null}
      {entry.rows.length === 0 ? null : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{entry.title}</caption>
            <thead>
              <tr>
                {entry.rowHeader === null ? null : <th scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">{entry.rowHeader}</th>}
                {entry.columns.map((column, index) => (
                  <th key={`${column}-${index}`} scope="col" className="px-2 py-1 text-[11px] font-medium text-chalk-muted">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entry.rows.map((row) => (
                <tr key={row.id} className="border-t border-white/10">
                  {entry.rowHeader === null ? null : (
                    <th scope="row" className="px-2 py-1 text-[13px] font-normal text-ink">
                      {row.label}
                    </th>
                  )}
                  {row.cells.map((cell) => (
                    <td key={cell.id} className="px-2 py-1 align-baseline">
                      <CellValue cell={cell} context={`techpack ${tabId}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entry.addLabel ? (
        <p className="text-[11px] text-chalk-muted" data-testid={`techpack-add-${entry.id}`}>
          {entry.addLabel}
        </p>
      ) : null}
    </div>
  );
}
