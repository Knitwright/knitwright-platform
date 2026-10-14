import type { ReactNode } from "react";
import type { HowToMeasureSection, MeasurementsSection } from "@/lib/techpack";
import { measureHeads, measureRowView, type MeasureCellView } from "@/lib/projects/tech-pack-measure-view";
import { Cellular, DocSection, DocTable, FillIn, RowHead } from "./parts";

/**
 * Below the sm breakpoint each row of the size table becomes a card, so no size is off the side
 * of the screen: the code and name, then the tolerance and every size with its label. From sm up
 * it is the table again. Only the layout changes; the cells are the same.
 */
const STACKED = [
  "max-sm:[&_table]:block max-sm:[&_table]:min-w-0 max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block",
  "max-sm:[&_tr]:flex max-sm:[&_tr]:flex-wrap max-sm:[&_tr]:items-baseline max-sm:[&_tr]:py-2",
  "max-sm:[&_td]:block max-sm:[&_th]:block max-sm:[&_th]:min-w-0 max-sm:[&_th]:flex-1",
].join(" ");

/** The name of a column, shown beside its value only when the table is stacked on a phone. */
const PhoneLabel = ({ text }: Readonly<{ text: string }>) => (
  <span className="mr-1 font-sans text-xs text-muted sm:hidden">{text}</span>
);

/** The styles of a compact value: a suggestion and an empty value use the attention colours. */
const VALUE_TONES: Readonly<Record<MeasureCellView["tone"], string>> = {
  person: "text-ink",
  derived: "text-muted",
  suggested: "bg-warn-wash text-warn",
  missing: "bg-warn-wash font-sans font-medium text-warn",
};

function MeasureValue({ cell, phoneLabel }: Readonly<{ cell: MeasureCellView; phoneLabel: string }>) {
  return (
    <td className={`px-2 py-1.5 text-right align-top ${cell.isBase ? "bg-cobalt-wash" : ""}`} title={cell.source ?? undefined}>
      <PhoneLabel text={phoneLabel} />
      <span data-tone={cell.tone} className={`inline-block rounded-md px-1.5 py-0.5 font-mono text-sm tabular-nums ${VALUE_TONES[cell.tone]}`}>
        {cell.text}
      </span>
    </td>
  );
}

type MeasurementsProps = Readonly<{ table: MeasurementsSection; forms?: ReactNode; confirm?: ReactNode }>;

/**
 * The compact size table: the code that ties a row to the drawing, one number per size in
 * centimetres with the base size marked, the tolerance, and where the row's values came from.
 */
export function MeasurementsView({ table, forms, confirm }: MeasurementsProps) {
  const sizes = measureHeads(table.columns);
  const base = sizes.find((size) => size.isBase);
  return (
    <DocSection id={table.id} title={table.title} note={table.note}>
      <p className="text-sm text-muted">
        {`Finished garment, in centimetres.${base ? ` The base size is ${base.label}, marked in blue.` : ""} The tolerance (±) is how far a measurement may be out, in either direction. Each row says where its values came from.`}
      </p>
      {table.groups.map((group) => (
        <div key={group.group} className={STACKED}>
          <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-hairline">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <caption className="sr-only">{`${group.label} measurements for each size, in centimetres`}</caption>
              <thead>
                <tr className="bg-white/[0.06] font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Code</th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Measurement</th>
                  {sizes.map((size) => (
                    <th key={size.label} scope="col" className={`px-2 py-2.5 text-right font-medium ${size.isBase ? "bg-cobalt-wash text-ink" : ""}`}>
                      {size.label}
                      {size.isBase ? <span className="block normal-case tracking-normal">base</span> : null}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2.5 text-right font-medium">
                    <span aria-hidden="true">±</span>
                    <span className="sr-only">Tolerance</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {group.rows.map((row) => {
                  const view = measureRowView(row, table.columns);
                  return (
                    <tr key={row.pointId} data-point={row.pointId} className="transition-colors hover:bg-white/[0.04]">
                      <td className="px-3 py-2 align-top font-mono text-cobalt-soft">{row.code}</td>
                      <th scope="row" className="px-3 py-2 text-left align-top font-medium text-ink">
                        {row.label}
                        {row.notes.length > 0 ? <span className="mt-1 block max-w-64 text-xs font-normal text-muted">{row.notes[0]}</span> : null}
                      </th>
                      {view.cells.map((cell, index) => (
                        <MeasureValue key={sizes[index]?.label ?? index} cell={cell} phoneLabel={sizes[index]?.phone ?? ""} />
                      ))}
                      <MeasureValue cell={view.tolerance} phoneLabel="Tolerance" />
                      <td className="px-3 py-2 align-top text-xs text-muted max-sm:basis-full">
                        <PhoneLabel text="Source" />
                        {view.sources.join("; ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {confirm}
      <FillIn summary="Fill in the measurements">{forms}</FillIn>
    </DocSection>
  );
}

export function HowToMeasureView({ section }: Readonly<{ section: HowToMeasureSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <div className={STACKED}>
        <DocTable caption="How to take each measurement" heads={["Code", "Measurement", "How to measure it"]}>
          {section.rows.map((row) => (
            <tr key={row.pointId}>
              <Cellular>
                <span className="font-mono">{row.code}</span>
              </Cellular>
              <RowHead>{row.label}</RowHead>
              <Cellular>{row.howToMeasure}</Cellular>
            </tr>
          ))}
        </DocTable>
      </div>
    </DocSection>
  );
}
