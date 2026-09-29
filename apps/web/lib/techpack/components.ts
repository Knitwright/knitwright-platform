import {
  componentSlotsFor,
  fabricFor,
  panelsFor,
  type ComponentKind,
  type FabricSpec,
  type GarmentSpec,
} from "@/lib/garment";
import { TBC, textCell, type Cell } from "./cell";
import { panelLabelOf } from "./labels";
import type { ComponentLine, ComponentsSection, FabricLine, PanelName } from "./types";
import { SECTION_TITLES } from "./types";

const KIND_LABELS: Readonly<Record<ComponentKind, string>> = {
  rib: "Rib",
  thread: "Thread",
  label: "Label",
  trim: "Trim",
};

const STRETCH_LABELS: Readonly<Record<Exclude<FabricSpec["stretch"], "not-set">, string>> = {
  none: "No stretch",
  "two-way": "Two-way stretch",
  "four-way": "Four-way stretch",
};

const SOME_MISSING = "Some details are still to be confirmed.";

/** Every detail of a fabric carries the source of the fabric. A detail nobody filled in is to be confirmed. */
function fabricLine(fabric: FabricSpec, panels: readonly PanelName[]): FabricLine {
  const from = (text: string): Cell => textCell(text, fabric.provenance);
  return {
    fabricId: fabric.id,
    panels,
    name: from(fabric.name),
    composition: from(fabric.composition),
    construction: from(fabric.construction),
    weight: from(fabric.weightGsm === null ? "" : `${fabric.weightGsm} gsm`),
    finish: from(fabric.finish),
    stretch: from(fabric.stretch === "not-set" ? "" : STRETCH_LABELS[fabric.stretch]),
    consumption: from(fabric.consumption),
  };
}

/** One line for each fabric that a panel uses, in the order the panels first use it, naming those panels. */
function fabricLines(spec: GarmentSpec): readonly FabricLine[] {
  const byFabric = new Map<string, { fabric: FabricSpec; panels: PanelName[] }>();
  for (const panel of panelsFor(spec)) {
    const fabric = fabricFor(spec, panel.id);
    const group = byFabric.get(fabric.id) ?? { fabric, panels: [] };
    byFabric.set(fabric.id, { fabric, panels: [...group.panels, { id: panel.id, label: panel.label }] });
  }
  return [...byFabric.values()].map((group) => fabricLine(group.fabric, group.panels));
}

function otherLines(spec: GarmentSpec): readonly ComponentLine[] {
  return componentSlotsFor(spec).map((slot) => {
    const entry = spec.components.find((candidate) => candidate.id === slot.id);
    const say = (text: string | undefined): Cell => (entry ? textCell(text ?? "", entry.provenance) : TBC);
    return {
      slotId: slot.id,
      label: slot.label,
      kind: slot.kind,
      kindLabel: KIND_LABELS[slot.kind],
      help: slot.help,
      panels: slot.panels.map((id) => ({ id, label: panelLabelOf(spec, id) })),
      name: say(entry?.name),
      details: say(entry?.details),
      quantity: say(entry?.quantity),
    };
  });
}

const fabricCells = (line: FabricLine): Cell[] => [
  line.name, line.composition, line.construction, line.weight, line.finish, line.stretch, line.consumption,
];

/**
 * The component list: the fabric of each panel, with panels that share a fabric on one line,
 * then thread, labels, rib and trims. Something the design implies but nobody described is
 * listed with its details to be confirmed. Nothing here is worked out: no quantity, no
 * consumption, no weight.
 */
export function buildComponents(spec: GarmentSpec): ComponentsSection {
  const fabrics = fabricLines(spec);
  const others = otherLines(spec);
  const missing =
    fabrics.some((line) => fabricCells(line).some((cell) => cell.status !== "set")) ||
    others.some((line) => [line.name, line.details, line.quantity].some((cell) => cell.status !== "set"));
  return { id: "components", title: SECTION_TITLES.components, note: missing ? SOME_MISSING : null, fabrics, others };
}
