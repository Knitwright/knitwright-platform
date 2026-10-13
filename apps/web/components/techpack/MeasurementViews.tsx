import type { ReactNode } from "react";
import type { HowToMeasureSection, MeasurementsSection } from "@/lib/techpack";
import { Cellular, DocSection, DocTable, FillIn, LengthText, RowHead, ToleranceText } from "./parts";

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

type MeasurementsProps = Readonly<{ table: MeasurementsSection; forms?: ReactNode; confirm?: ReactNode }>;

export function MeasurementsView({ table, forms, confirm }: MeasurementsProps) {
  const heads = [
    "Code",
    "Measurement",
    "Tolerance",
    ...table.columns.map((column) => (column.isBase ? `${column.label} (base size)` : column.label)),
  ];
  return (
    <DocSection id={table.id} title={table.title} note={table.note}>
      <p className="text-sm text-muted">
        Lengths are in centimetres. Each value says where it came from. The tolerance is how far a measurement may be
        out, in either direction.
      </p>
      {table.groups.map((group) => (
        <div key={group.group} className={STACKED}>
          <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
          <DocTable caption={`${group.label} measurements for each size`} heads={heads}>
            {group.rows.map((row) => (
              <tr key={row.pointId} data-point={row.pointId}>
                <Cellular>
                  <span className="font-mono">{row.code}</span>
                </Cellular>
                <RowHead>
                  {row.label}
                  {row.notes.length > 0 ? <span className="mt-1 block max-w-64 text-xs font-normal text-muted">{row.notes[0]}</span> : null}
                </RowHead>
                <Cellular>
                  <PhoneLabel text="Tolerance" />
                  <ToleranceText cell={row.tolerance} />
                </Cellular>
                {row.values.map((value, index) => (
                  <Cellular key={table.columns[index]?.label ?? index}>
                    <PhoneLabel text={heads[index + 3] ?? ""} />
                    <LengthText cell={value} />
                  </Cellular>
                ))}
              </tr>
            ))}
          </DocTable>
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
