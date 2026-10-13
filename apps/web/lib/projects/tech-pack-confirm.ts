import {
  FABRIC_FIELDS,
  LABELLING_FIELDS,
  LABELLING_LABELS,
  PROVENANCE_LABELS,
  applyAction,
  componentSlotsFor,
  fabricFieldHasValue,
  getType,
  seamsFor,
  type FabricChanges,
  type GarmentSpec,
  type LabellingField,
  type Provenance,
  type SpecAction,
} from "@/lib/garment";
import { PROPOSAL_WORDS, SUGGESTION_SOURCES, listOf, type Cell, type SectionId, type TechPack } from "@/lib/techpack";

/**
 * Confirming what Knitwright or a chart suggested or proposed. A confirmed value becomes the
 * person's own: it is saved again with `user-edited` as its source, which is what the server
 * writes for anything a browser sends. Nothing here says a value was checked: a person
 * confirming a suggestion is not a technician signing it off.
 *
 * Each thing to confirm is plain data, so the server can list them. The changes are worked
 * out in the browser, from the design as it will be once the waiting changes are saved, so a
 * confirmation never undoes a change still on its way.
 */

const USER = "user-edited" as const;

export type ConfirmTarget =
  | Readonly<{ kind: "option"; optionId: string; choiceId: string }>
  | Readonly<{ kind: "sizes"; sizes: readonly string[]; baseSize: string }>
  | Readonly<{
      kind: "measurement";
      pointId: string;
      /** Each suggested value. A size of null is the base size, or the only column when there are no sizes. */
      values: readonly Readonly<{ size: string | null; tenthsMm: number }>[];
      /** The suggested tolerance, or null when it is not a suggestion. */
      tolerance: number | null;
    }>
  | Readonly<{ kind: "fabric"; fabricId: string }>
  | Readonly<{ kind: "colourway"; colourwayId: string }>
  | Readonly<{ kind: "component"; slotId: string }>
  | Readonly<{ kind: "seam-class" | "stitch-class"; seamId: string; classId: string }>
  | Readonly<{ kind: "construction"; seamId: string }>
  | Readonly<{ kind: "labelling"; field: LabellingField }>
  | Readonly<{ kind: "artwork"; artworkId: string }>
  | Readonly<{ kind: "names-numbers" }>;

export interface Confirmable {
  /** Names the confirmation, and keeps a problem with it. */
  readonly key: string;
  readonly sectionId: SectionId;
  /** What is confirmed, with the value, in plain words. */
  readonly label: string;
  /** Who suggested or proposed it. */
  readonly source: string;
  readonly target: ConfirmTarget;
}

const isSuggestion = (provenance: Provenance): boolean => SUGGESTION_SOURCES.includes(provenance);
const suggested = (cell: Cell): cell is Extract<Cell, { status: "set" }> => cell.status === "set" && isSuggestion(cell.provenance);

const confirmable = (sectionId: SectionId, key: string, label: string, source: string, target: ConfirmTarget): Confirmable => ({
  key: `confirm:${sectionId}:${key}`,
  sectionId,
  label,
  source,
  target,
});

function coverConfirmables(spec: GarmentSpec, pack: TechPack): Confirmable[] {
  const options = pack.cover.options.flatMap((option) => {
    const chosen = spec.options[option.id];
    if (!chosen || !suggested(option.choice)) return [];
    const target = { kind: "option", optionId: option.id, choiceId: chosen.choiceId } as const;
    return [confirmable("cover", `option:${option.id}`, `${option.label}: ${option.choice.value}`, PROVENANCE_LABELS[option.choice.provenance], target)];
  });
  const { sizeRun, baseSize } = pack.cover;
  if (!suggested(sizeRun) || baseSize.status !== "set") return options;
  const sizes = pack.measurements.columns.flatMap((column) => (column.size === null ? [] : [column.size]));
  const label = `Sizes ${sizeRun.value}, with ${baseSize.value} as the base size`;
  return [...options, confirmable("cover", "sizes", label, PROVENANCE_LABELS[sizeRun.provenance], { kind: "sizes", sizes, baseSize: baseSize.value })];
}

function measurementConfirmables(pack: TechPack): Confirmable[] {
  const { columns, groups } = pack.measurements;
  return groups.flatMap((group) =>
    group.rows.flatMap((row) => {
      const values = row.values.flatMap((cell, index) => {
        const column = columns[index];
        if (!column || cell.status !== "set" || !isSuggestion(cell.provenance)) return [];
        return [{ size: column.isBase ? null : column.size, label: column.label, tenthsMm: cell.tenthsMm, provenance: cell.provenance }];
      });
      const tolerance = row.tolerance.status === "set" && isSuggestion(row.tolerance.provenance) ? row.tolerance : null;
      if (values.length === 0 && tolerance === null) return [];
      const words = [
        ...(values.length > 0 ? [`${values.length === 1 ? "size" : "sizes"} ${listOf(values.map((value) => value.label))}`] : []),
        ...(tolerance ? [`tolerance ${tolerance.value} cm`] : []),
      ];
      const source = values[0]?.provenance ?? tolerance?.provenance ?? "suggested-chart";
      const target = {
        kind: "measurement",
        pointId: row.pointId,
        values: values.map(({ size, tenthsMm }) => ({ size, tenthsMm })),
        tolerance: tolerance?.tenthsMm ?? null,
      } as const;
      return [confirmable("measurements", row.pointId, `${row.label}: ${listOf(words)}`, PROVENANCE_LABELS[source], target)];
    }),
  );
}

/** The fields of a fabric whose value is a suggestion, the name included. */
function suggestedFabricFields(fabric: GarmentSpec["fabrics"][number]): string[] {
  const fields = FABRIC_FIELDS.filter((field) => {
    const source = fabric.sources[field];
    return source !== undefined && fabricFieldHasValue(fabric, field) && isSuggestion(source);
  });
  return [...(isSuggestion(fabric.provenance) ? ["name"] : []), ...fields];
}

const FIELD_WORDS: Readonly<Record<string, string>> = { weightGsm: "weight" };

function componentConfirmables(spec: GarmentSpec): Confirmable[] {
  const fabrics = spec.fabrics.flatMap((fabric) => {
    const fields = suggestedFabricFields(fabric);
    if (fields.length === 0) return [];
    const words = listOf(fields.map((field) => FIELD_WORDS[field] ?? field));
    const source = fields[0] === "name" ? fabric.provenance : (fabric.sources[fields[0] as keyof typeof fabric.sources] ?? fabric.provenance);
    return [confirmable("components", `fabric:${fabric.id}`, `Fabric ${fabric.name}: ${words}`, PROVENANCE_LABELS[source], { kind: "fabric", fabricId: fabric.id })];
  });
  const parts = componentSlotsFor(spec).flatMap((slot) => {
    const entry = spec.components.find((candidate) => candidate.id === slot.id);
    const target = { kind: "component", slotId: slot.id } as const;
    if (!entry) return slot.proposal ? [confirmable("components", slot.id, `${slot.label} is used`, PROPOSAL_WORDS, target)] : [];
    if (!isSuggestion(entry.provenance)) return [];
    const said = entry.notUsed ? "not used" : listOf([entry.name, entry.details, entry.quantity].filter((text) => text !== ""));
    return [confirmable("components", slot.id, `${slot.label}: ${said}`, PROVENANCE_LABELS[entry.provenance], target)];
  });
  return [...fabrics, ...parts];
}

function constructionConfirmables(spec: GarmentSpec): Confirmable[] {
  return seamsFor(spec).flatMap((seam) => {
    const entry = spec.construction.find((candidate) => candidate.seamId === seam.id);
    const found: Confirmable[] = [];
    if (entry?.seamClass === undefined) {
      const label = `${seam.label}: seam class ${seam.seamClass.name}, ISO ${seam.seamClass.iso}`;
      found.push(confirmable("construction", `${seam.id}:seam`, label, PROPOSAL_WORDS, { kind: "seam-class", seamId: seam.id, classId: seam.seamClass.id }));
    }
    if (entry?.stitchClass === undefined) {
      const label = `${seam.label}: stitch class ${seam.stitchClass.name}, ISO ${seam.stitchClass.iso}`;
      found.push(confirmable("construction", `${seam.id}:stitch`, label, PROPOSAL_WORDS, { kind: "stitch-class", seamId: seam.id, classId: seam.stitchClass.id }));
    }
    if (entry && isSuggestion(entry.provenance)) {
      found.push(confirmable("construction", `${seam.id}:entry`, `${seam.label}: what was suggested for it`, PROVENANCE_LABELS[entry.provenance], { kind: "construction", seamId: seam.id }));
    }
    return found;
  });
}

function colourwayConfirmables(spec: GarmentSpec, pack: TechPack): Confirmable[] {
  return spec.colourways.flatMap((colourway) => {
    const colours = colourway.colours.filter((colour) => isSuggestion(colour.provenance));
    const first = colours[0];
    if (!first) return [];
    const block = pack.colourways.colourways.find((entry) => entry.id === colourway.id);
    const parts = colours.map((colour) => block?.rows.find((row) => row.panelId === colour.panelId)?.label ?? colour.panelId);
    const label = `${colourway.name}: colours of ${listOf(parts)}`;
    return [confirmable("colourways", colourway.id, label, PROVENANCE_LABELS[first.provenance], { kind: "colourway", colourwayId: colourway.id })];
  });
}

function otherConfirmables(spec: GarmentSpec): Confirmable[] {
  const labels = LABELLING_FIELDS.flatMap((field) => {
    const value = spec.labelling[field];
    if (!value || !isSuggestion(value.provenance)) return [];
    return [confirmable("labelling", field, `${LABELLING_LABELS[field]}: ${value.text}`, PROVENANCE_LABELS[value.provenance], { kind: "labelling", field })];
  });
  const artwork = spec.artwork.flatMap((art) =>
    isSuggestion(art.provenance)
      ? [confirmable("artwork", art.id, `Artwork ${art.name}`, PROVENANCE_LABELS[art.provenance], { kind: "artwork", artworkId: art.id })]
      : [],
  );
  const marks = spec.namesAndNumbers;
  const players =
    marks && isSuggestion(marks.provenance)
      ? [confirmable("artwork", "names-numbers", "Player names and numbers", PROVENANCE_LABELS[marks.provenance], { kind: "names-numbers" })]
      : [];
  return [...artwork, ...players, ...labels];
}

/**
 * Everything on the tech pack that a chart, the assistant or a picture suggested, or that
 * Knitwright proposed, and nobody has confirmed. Each can be confirmed on its own.
 */
export function confirmables(spec: GarmentSpec, pack: TechPack): readonly Confirmable[] {
  if (!getType(spec.typeId)) return [];
  return [
    ...coverConfirmables(spec, pack),
    ...measurementConfirmables(pack),
    ...componentConfirmables(spec),
    ...constructionConfirmables(spec),
    ...colourwayConfirmables(spec, pack),
    ...otherConfirmables(spec),
  ];
}

function measurementActions(target: Extract<ConfirmTarget, { kind: "measurement" }>): SpecAction[] {
  const values = target.values.map(({ size, tenthsMm }): SpecAction =>
    size === null
      ? { type: "set-measurement", pointId: target.pointId, value: tenthsMm, provenance: USER }
      : { type: "set-size-measurement", entry: { pointId: target.pointId, size, value: tenthsMm, provenance: USER } },
  );
  const tolerance: SpecAction[] =
    target.tolerance === null ? [] : [{ type: "set-tolerance", entry: { pointId: target.pointId, value: target.tolerance, provenance: USER } }];
  return [...values, ...tolerance];
}

function fabricActions(spec: GarmentSpec, fabricId: string): SpecAction[] {
  const fabric = spec.fabrics.find((entry) => entry.id === fabricId);
  if (!fabric) return [];
  const fields = suggestedFabricFields(fabric);
  if (fields.length === 0) return [];
  const changes = Object.fromEntries(fields.map((field) => [field, fabric[field as keyof typeof fabric]])) as FabricChanges;
  return [{ type: "change-fabric", id: fabricId, changes, provenance: USER }];
}

function componentActions(spec: GarmentSpec, slotId: string): SpecAction[] {
  const entry = spec.components.find((candidate) => candidate.id === slotId);
  if (entry) return isSuggestion(entry.provenance) ? [{ type: "set-component", component: { ...entry, provenance: USER } }] : [];
  const slot = componentSlotsFor(spec).find((candidate) => candidate.id === slotId);
  if (!slot?.proposal) return [];
  return [{ type: "set-component", component: { id: slotId, name: "", details: "", quantity: "", used: true, provenance: USER } }];
}

/** A seam's entry with one class chosen, keeping what else the entry holds. */
function classActions(spec: GarmentSpec, target: Extract<ConfirmTarget, { kind: "seam-class" | "stitch-class" }>): SpecAction[] {
  const entry = spec.construction.find((candidate) => candidate.seamId === target.seamId);
  const field = target.kind === "seam-class" ? "seamClass" : "stitchClass";
  if (entry?.[field] !== undefined) return [];
  const next = {
    seamId: target.seamId,
    ...(entry?.seamClass === undefined ? {} : { seamClass: entry.seamClass }),
    ...(entry?.stitchClass === undefined ? {} : { stitchClass: entry.stitchClass }),
    [field]: target.classId,
    stitchDensity: entry?.stitchDensity ?? "",
    provenance: USER,
  };
  return [{ type: "set-construction", entry: next }];
}

/**
 * The changes that confirm one thing, worked out from the design as it is now. Nothing comes
 * back when the thing is gone or is the person's own already, so confirming twice does nothing.
 */
export function confirmActions(spec: GarmentSpec, target: ConfirmTarget): readonly SpecAction[] {
  switch (target.kind) {
    case "option": {
      const chosen = spec.options[target.optionId];
      if (chosen?.choiceId !== target.choiceId || !isSuggestion(chosen.provenance)) return [];
      return [{ type: "set-option", optionId: target.optionId, choiceId: target.choiceId, provenance: USER }];
    }
    case "sizes":
      return spec.sizing ? [] : [{ type: "set-sizing", sizing: { sizes: target.sizes, baseSize: target.baseSize } }];
    case "measurement":
      return measurementActions(target);
    case "fabric":
      return fabricActions(spec, target.fabricId);
    case "colourway": {
      const colourway = spec.colourways.find((entry) => entry.id === target.colourwayId);
      if (!colourway?.colours.some((colour) => isSuggestion(colour.provenance))) return [];
      const colours = colourway.colours.map((colour) => ({ ...colour, provenance: USER }));
      return [{ type: "update-colourway", colourway: { ...colourway, colours } }];
    }
    case "component":
      return componentActions(spec, target.slotId);
    case "seam-class":
    case "stitch-class":
      return classActions(spec, target);
    case "construction": {
      const entry = spec.construction.find((candidate) => candidate.seamId === target.seamId);
      return entry && isSuggestion(entry.provenance) ? [{ type: "set-construction", entry: { ...entry, provenance: USER } }] : [];
    }
    case "labelling": {
      const value = spec.labelling[target.field];
      return value && isSuggestion(value.provenance) ? [{ type: "set-labelling", field: target.field, text: value.text, provenance: USER }] : [];
    }
    case "artwork": {
      const art = spec.artwork.find((entry) => entry.id === target.artworkId);
      return art && isSuggestion(art.provenance) ? [{ type: "update-artwork", artwork: { ...art, provenance: USER } }] : [];
    }
    case "names-numbers": {
      const marks = spec.namesAndNumbers;
      return marks && isSuggestion(marks.provenance) ? [{ type: "set-names-numbers", namesAndNumbers: { ...marks, provenance: USER } }] : [];
    }
  }
}

/**
 * The changes that confirm several things, in order. Each is worked out from the design with
 * the ones before it applied, so two confirmations of one seam keep each other. A change the
 * rules refuse is left out.
 */
export function confirmAllActions(spec: GarmentSpec, targets: readonly ConfirmTarget[]): readonly SpecAction[] {
  const found: SpecAction[] = [];
  let current = spec;
  for (const target of targets) {
    for (const action of confirmActions(current, target)) {
      const result = applyAction(current, action);
      if (!result.ok) continue;
      current = result.spec;
      found.push(action);
    }
  }
  return found;
}
