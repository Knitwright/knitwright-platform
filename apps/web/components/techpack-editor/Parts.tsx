import { WhyButton } from "@/components/studio/editor/WhyButton";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { GAP_RULE } from "@/lib/kpp/model";
import { PROVENANCE_CHIPS, PROVENANCE_ORDER, type FieldProvenance } from "@/lib/techpack/view/fields";
import type { EditorPart } from "@/lib/techpack/editor/tabs";
import { isQcOnly, QC_FILLS, QC_ONLY_REASON } from "@/lib/techpack/editor/qc-only";
import type { ViewCell } from "@/lib/techpack/view/fields";
import type { TabSection, ViewTable } from "@/lib/techpack/view/rows";
import type { TechPackTabId } from "@/lib/techpack/view/tabs";

/**
 * The tables every tab of the tech pack editor is drawn with (spec screen 30): a Field | Value table
 * for a section's fields and a plain table for each of its tables, in the `10` §8 table style. A value
 * nobody has given reads "Needs your input" in `warn`, never a nought; a 🔒 row says who sets it.
 */

const BASE_REASON = "The base article fixes this.";

/** One value, or what stands in for a missing one. */
export function CellValue({ cell, from }: Readonly<{ cell: ViewCell; from: TechPackTabId }>) {
  if (isQcOnly(cell, from) && cell.text === null) return <span className="text-muted">{QC_FILLS}</span>;
  if (cell.text === null)
    return (
      <span className="text-warn" data-provenance={cell.provenance}>
        Needs your input
      </span>
    );
  // Spec F-S6: every field says where it came from. The words are read out; the legend shows the counts.
  return (
    <span data-provenance={cell.provenance}>
      {cell.text}
      <span className="sr-only"> ({PROVENANCE_CHIPS[cell.provenance]})</span>
    </span>
  );
}

/** "Why?" beside a value a rule explains (spec decision 11). A gap rule explains nothing yet, so it gets none. */
export const WhyOf = ({ cell, context }: Readonly<{ cell: ViewCell; context: string }>) =>
  cell.ruleId === GAP_RULE ? null : <WhyButton ruleId={cell.ruleId} context={context} />;

/** The four sources and how many values of the view carry each, under the tabs. */
export function ProvenanceLegend({ counts }: Readonly<{ counts: Readonly<Record<FieldProvenance, number>> }>) {
  return (
    <ul aria-label="Where the values come from" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted" data-testid="techpack-legend">
      {PROVENANCE_ORDER.map((id) => (
        <li key={id} data-testid={`legend-${id}`} data-count={counts[id]}>
          {PROVENANCE_CHIPS[id]} <span className="font-semibold text-text-2">{counts[id]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Why a value is locked, or nothing for one a founder edits. */
export const lockOf = (cell: ViewCell, from: TechPackTabId): string | undefined =>
  isQcOnly(cell, from) ? QC_ONLY_REASON : cell.locked ? BASE_REASON : undefined;

type FieldsProps = Readonly<{
  fields: readonly ViewCell[];
  from: TechPackTabId;
  caption: string;
  numbered?: boolean;
  first?: number;
}>;

/** The Field | Value table of the Overview and Labels references (s08, s14). */
export function FieldTable({ fields, from, caption, numbered = false, first = 1 }: FieldsProps) {
  if (fields.length === 0) return null;
  return (
    <Table caption={caption}>
      <thead>
        <tr>
          {numbered ? (
            <Th className="w-10">
              <span className="sr-only">Row</span>
            </Th>
          ) : null}
          <Th>Field</Th>
          <Th>Value</Th>
        </tr>
      </thead>
      <tbody>
        {fields.map((cell, index) => (
          <Tr key={cell.id}>
            {numbered ? <Td className="text-caption text-muted">{first + index}</Td> : null}
            <Td className="font-medium">{cell.label}</Td>
            <Td lockedReason={lockOf(cell, from)} data-testid={`tp-cell-${cell.id}`}>
              <CellValue cell={cell} from={from} />
              {cell.locked ? <WhyOf cell={cell} context={`tech pack ${cell.label}`} /> : null}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export function RowsTable({ table, from }: Readonly<{ table: ViewTable; from: TechPackTabId }>) {
  return (
    <Table caption={table.title}>
      <thead>
        <tr>
          {table.rowHeader === null ? null : <Th>{table.rowHeader}</Th>}
          {table.columns.map((column) => (
            <Th key={column}>{column}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.length === 0 ? (
          <tr>
            <td colSpan={table.columns.length + (table.rowHeader === null ? 0 : 1)} className="px-3 py-4 text-small text-muted">
              Nothing here yet.
            </td>
          </tr>
        ) : (
          table.rows.map((row) => (
            <Tr key={row.id}>
              {table.rowHeader === null ? null : <Td className="font-medium">{row.label}</Td>}
              {row.cells.map((cell) => (
                <Td key={cell.id} lockedReason={isQcOnly(cell, from) ? QC_ONLY_REASON : undefined}>
                  <CellValue cell={cell} from={from} />
                </Td>
              ))}
            </Tr>
          ))
        )}
      </tbody>
    </Table>
  );
}

export function SectionView({ section, from, showTitle }: Readonly<{ section: TabSection; from: TechPackTabId; showTitle: boolean }>) {
  return (
    <section aria-label={section.title} className="flex flex-col gap-2" data-testid={`tp-section-${from}-${section.id}`}>
      {showTitle ? <h4 className="px-3 text-small font-semibold text-text-2">{section.title}</h4> : null}
      {section.note ? <p className="px-3 text-small text-muted">{section.note}</p> : null}
      <FieldTable fields={section.fields} from={from} caption={section.title} />
      {section.tables.map((table) => (
        <RowsTable key={table.id} table={table} from={from} />
      ))}
    </section>
  );
}

/** A folded tab's heading: its old name, the 🔒 when only QC edits it, and its one-line lead. */
export function PartHeading({ part }: Readonly<{ part: EditorPart }>) {
  if (part.heading === null) return null;
  return (
    <header className="mt-4 flex flex-col gap-1 border-t border-border px-3 pt-4" data-testid={`tp-part-${part.from}`}>
      <h3 className="text-title text-text">
        {part.heading}
        {part.from === "qc" ? <span className="ml-2 text-caption font-medium text-muted">🔒 Knitwright QC only</span> : null}
      </h3>
      <p className="text-small text-muted">{part.lead}</p>
    </header>
  );
}

/** A part drawn the plain way: its heading, then every section. */
export function PartView({ part }: Readonly<{ part: EditorPart }>) {
  const many = part.sections.length > 1;
  return (
    <div className="flex flex-col gap-4">
      <PartHeading part={part} />
      {part.sections.map((section) => (
        <SectionView key={section.id} section={section} from={part.from} showTitle={many || part.heading !== null} />
      ))}
    </div>
  );
}
