import type { GarmentSpec } from "@/lib/garment";
import { TO_BE_CONFIRMED, type Cell } from "@/lib/techpack/cell";
import { buildComponents } from "@/lib/techpack/components";
import { buildLabelling } from "@/lib/techpack/labelling";

/**
 * Short, read-only summaries of the fabric, trims and labelling of a design, for the workspace's
 * Fabric and Labels panels. They are filled in on the factory file, which builds the same lines.
 */

export interface Fact {
  readonly label: string;
  readonly value: string;
}

interface FabricCard {
  readonly id: string;
  readonly title: string;
  /** The parts that use the fabric, in words. */
  readonly parts: string;
  readonly facts: readonly Fact[];
}

const text = (cell: Cell): string => (cell.status === "set" ? cell.value : TO_BE_CONFIRMED);

export function fabricSummary(spec: GarmentSpec): readonly FabricCard[] {
  return buildComponents(spec).fabrics.map((line) => ({
    id: line.fabricId,
    title: text(line.name),
    parts: line.panels.map((panel) => panel.label).join(", "),
    facts: [
      { label: "Composition", value: text(line.composition) },
      { label: "Weight", value: text(line.weight) },
      { label: "Finish", value: text(line.finish) },
    ],
  }));
}

/** Thread, labels, rib and trims: each by its name, with its description or what is missing. */
export function trimSummary(spec: GarmentSpec): readonly Fact[] {
  return buildComponents(spec).others.map((line) => ({ label: line.label, value: text(line.name) }));
}

export function labellingSummary(spec: GarmentSpec): readonly Fact[] {
  return buildLabelling(spec).rows.map((row) => ({ label: row.label, value: text(row.value) }));
}
