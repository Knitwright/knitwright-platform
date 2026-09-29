import type { HowToMeasureSection, MeasurementsSection } from "@/lib/techpack";
import { Cellular, DocSection, DocTable, LengthText, RowHead, ToleranceText } from "./parts";

export function MeasurementsView({ table }: Readonly<{ table: MeasurementsSection }>) {
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
        <div key={group.group}>
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
                  <ToleranceText cell={row.tolerance} />
                </Cellular>
                {row.values.map((value, index) => (
                  <Cellular key={table.columns[index]?.label ?? index}>
                    <LengthText cell={value} />
                  </Cellular>
                ))}
              </tr>
            ))}
          </DocTable>
        </div>
      ))}
    </DocSection>
  );
}

export function HowToMeasureView({ section }: Readonly<{ section: HowToMeasureSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
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
    </DocSection>
  );
}
