import {
  COMPONENT_KIND_LABELS,
  componentSlotsFor,
  fabricFor,
  panelsFor,
  type FabricField,
  type FabricSpec,
  type GarmentSpec,
} from "@/lib/garment";
import { TBC, numberCell, textCell, type Cell } from "./cell";
import { panelLabelOf } from "./labels";
import { PROPOSAL_WORDS, SOME_MISSING } from "./text";
import type { ComponentLine, ComponentsSection, FabricLine, PanelName } from "./types";
import { SECTION_TITLES } from "./types";

const STRETCH_LABELS: Readonly<Record<Exclude<FabricSpec["stretch"], "not-set">, string>> = {
  none: "No stretch",
  "two-way": "Two-way stretch",
  "four-way": "Four-way stretch",
};

/**
 * Every described field of a fabric carries its own source, so a field a person changed is theirs
 * and one that was suggested stays a suggestion. The name has the source of the fabric. A field
 * nobody filled in is to be confirmed.
 */
function fabricLine(fabric: FabricSpec, panels: readonly PanelName[]): FabricLine {
  const field = (text: string, name: FabricField): Cell => textCell(text, fabric.sources[name] ?? fabric.provenance);
  return {
    fabricId: fabric.id,
    panels,
    name: textCell(fabric.name, fabric.provenance),
    composition: field(fabric.composition, "composition"),
    construction: field(fabric.construction, "construction"),
    weight: numberCell(fabric.weightGsm, "grams per square metre", "gsm", fabric.sources.weightGsm ?? fabric.provenance),
    finish: field(fabric.finish, "finish"),
    stretch: field(fabric.stretch === "not-set" ? "" : STRETCH_LABELS[fabric.stretch], "stretch"),
    consumption: field(fabric.consumption, "consumption"),
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

const RIB_NOTE =
  "The fabric of this part is set in the fabric table above. This line is for the details of the rib itself.";
const NOT_USED = "Not used";

function otherLines(spec: GarmentSpec): readonly ComponentLine[] {
  return componentSlotsFor(spec).map((slot) => {
    const entry = spec.components.find((candidate) => candidate.id === slot.id);
    const notUsed = entry?.notUsed === true;
    const say = (text: string | undefined): Cell => {
      if (!entry) return TBC;
      return notUsed ? textCell(NOT_USED, entry.provenance) : textCell(text ?? "", entry.provenance);
    };
    return {
      slotId: slot.id,
      label: slot.label,
      kind: slot.kind,
      kindLabel: COMPONENT_KIND_LABELS[slot.kind],
      help: slot.help,
      note: slot.kind === "rib" ? RIB_NOTE : null,
      panels: slot.panels.map((id) => ({ id, label: panelLabelOf(spec, id) })),
      notUsed,
      proposalNote: slot.proposal && !entry ? { status: "set", value: PROPOSAL_WORDS, provenance: "derived", proposal: true } : null,
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
