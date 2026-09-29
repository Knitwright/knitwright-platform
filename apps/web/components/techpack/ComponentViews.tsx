import type { ReactNode } from "react";
import type { ComponentsSection, ConstructionSection } from "@/lib/techpack";
import { Cellular, CellText, ClassText, DocSection, DocTable, RowHead } from "./parts";

const panelNames = (panels: readonly { label: string }[]): string => panels.map((panel) => panel.label).join(", ");

type ComponentsProps = Readonly<{ section: ComponentsSection; forms: ReactNode }>;

export function ComponentsView({ section, forms }: ComponentsProps) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <h3 className="text-sm font-semibold text-ink">Fabric</h3>
      <DocTable
        caption="Fabric for each part of the garment"
        heads={["Used for", "Fabric", "Composition", "Construction", "Weight", "Finish", "Stretch", "Fabric used for one garment"]}
      >
        {section.fabrics.map((line) => (
          <tr key={line.fabricId} data-fabric={line.fabricId}>
            <RowHead>{panelNames(line.panels)}</RowHead>
            <Cellular>
              <CellText cell={line.name} />
            </Cellular>
            <Cellular>
              <CellText cell={line.composition} />
            </Cellular>
            <Cellular>
              <CellText cell={line.construction} />
            </Cellular>
            <Cellular>
              <CellText cell={line.weight} />
            </Cellular>
            <Cellular>
              <CellText cell={line.finish} />
            </Cellular>
            <Cellular>
              <CellText cell={line.stretch} />
            </Cellular>
            <Cellular>
              <CellText cell={line.consumption} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      <h3 className="text-sm font-semibold text-ink">Rib, thread, labels and trims</h3>
      <DocTable caption="Rib, thread, labels and trims" heads={["Item", "Kind", "Name", "Details", "Quantity"]}>
        {section.others.map((line) => (
          <tr key={line.slotId} data-component={line.slotId}>
            <RowHead>
              {line.label}
              <span className="mt-1 block max-w-64 text-xs font-normal text-muted">{line.help}</span>
            </RowHead>
            <Cellular>{line.kindLabel}</Cellular>
            <Cellular>
              <CellText cell={line.name} />
            </Cellular>
            <Cellular>
              <CellText cell={line.details} />
            </Cellular>
            <Cellular>
              <CellText cell={line.quantity} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      <details className="rounded-xl border border-hairline p-4">
        <summary className="cursor-pointer text-[15px] font-medium text-ink">Fill in fabrics and components</summary>
        <div className="mt-4">{forms}</div>
      </details>
    </DocSection>
  );
}

type ConstructionProps = Readonly<{ section: ConstructionSection; forms: ReactNode }>;

export function ConstructionView({ section, forms }: ConstructionProps) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <DocTable caption="Seams, and how each is sewn" heads={["Seam", "Joins", "Seam class", "Stitch class", "Stitch density"]}>
        {section.seams.map((seam) => (
          <tr key={seam.seamId} data-seam={seam.seamId}>
            <RowHead>{seam.label}</RowHead>
            <Cellular>{panelNames(seam.panels)}</Cellular>
            <Cellular>
              <ClassText cell={seam.seamClass} />
            </Cellular>
            <Cellular>
              <ClassText cell={seam.stitchClass} />
            </Cellular>
            <Cellular>
              <CellText cell={seam.stitchDensity} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      <details className="rounded-xl border border-hairline p-4">
        <summary className="cursor-pointer text-[15px] font-medium text-ink">Fill in the stitching</summary>
        <div className="mt-4">{forms}</div>
      </details>
    </DocSection>
  );
}
