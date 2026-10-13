import type { ReactNode } from "react";
import type { ComponentsSection, ConstructionSection } from "@/lib/techpack";
import { Cellular, CellText, ClassText, DocSection, DocTable, FillIn, RowHead } from "./parts";

const panelNames = (panels: readonly { label: string }[]): string => panels.map((panel) => panel.label).join(", ");

type ComponentsProps = Readonly<{ section: ComponentsSection; forms: ReactNode; confirm?: ReactNode }>;

export function ComponentsView({ section, forms, confirm }: ComponentsProps) {
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
              {line.note ? <span className="mt-1 block max-w-64 text-xs font-normal text-muted">{line.note}</span> : null}
              {line.proposalNote ? (
                <span className="mt-1 block max-w-64 rounded-md bg-warn-wash px-2 py-0.5 text-xs font-normal text-warn">
                  {line.proposalNote.value}
                </span>
              ) : null}
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
      {confirm}
      <FillIn summary="Fill in fabrics and components">{forms}</FillIn>
    </DocSection>
  );
}

type ConstructionProps = Readonly<{ section: ConstructionSection; forms: ReactNode; confirm?: ReactNode }>;

export function ConstructionView({ section, forms, confirm }: ConstructionProps) {
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
              {seam.caveat ? (
                <span className="mt-1 block max-w-64 rounded-md bg-warn-wash px-2 py-0.5 text-xs text-warn">{seam.caveat}</span>
              ) : null}
            </Cellular>
            <Cellular>
              <CellText cell={seam.stitchDensity} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      {confirm}
      <FillIn summary="Fill in the stitching">{forms}</FillIn>
    </DocSection>
  );
}
