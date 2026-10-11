import {
  LABELLING_FIELDS,
  LABELLING_LABELS,
  PLACE_DEFINITIONS,
  PROVENANCE_LABELS,
  formatCm,
  getType,
  type Colourway,
  type FabricSpec,
  type GarmentSpec,
  type OptionChoice,
  type PanelColour,
  type Provenance,
  type ResolvedType,
} from "@/lib/garment";

const WEARER_LABELS: Readonly<Record<string, string>> = { men: "Men", women: "Women", youth: "Youth" };

const sourceNote = (provenance: Provenance): string => `now marked ${PROVENANCE_LABELS[provenance]}`;

function choiceLabel(type: ResolvedType | undefined, optionId: string, choiceId: string): string {
  const option = type?.options.find((entry) => entry.id === optionId);
  return [...(option?.choices ?? []), ...(option?.notOffered ?? [])].find((choice) => choice.id === choiceId)?.label ?? choiceId;
}

const optionLabel = (types: readonly (ResolvedType | undefined)[], optionId: string): string =>
  types.map((type) => type?.options.find((entry) => entry.id === optionId)?.label).find((label) => label !== undefined) ?? optionId;

function optionSentence(
  types: { readonly before?: ResolvedType; readonly after?: ResolvedType },
  optionId: string,
  was: OptionChoice | undefined,
  now: OptionChoice | undefined,
): string | null {
  const label = optionLabel([types.after, types.before], optionId);
  if (!now) return `${label} no longer applies to this garment.`;
  const nowName = choiceLabel(types.after, optionId, now.choiceId);
  if (!was) return `${label} set to ${nowName}.`;
  if (was.choiceId !== now.choiceId) {
    return `${label} changed from ${choiceLabel(types.before, optionId, was.choiceId)} to ${nowName}.`;
  }
  return was.provenance === now.provenance ? null : `${label} stays ${nowName}, ${sourceNote(now.provenance)}.`;
}

function explainOptions(before: GarmentSpec, after: GarmentSpec): string[] {
  const types = { before: getType(before.typeId), after: getType(after.typeId) };
  const ids = [...new Set([...Object.keys(after.options), ...Object.keys(before.options)])];
  const order = (types.after ?? types.before)?.options.map((option) => option.id) ?? [];
  const rank = (id: string): number => (order.includes(id) ? order.indexOf(id) : order.length);
  return ids
    .sort((a, b) => rank(a) - rank(b))
    .map((id) =>
      optionSentence(
        types,
        id,
        Object.hasOwn(before.options, id) ? before.options[id] : undefined,
        Object.hasOwn(after.options, id) ? after.options[id] : undefined,
      ),
    )
    .filter((sentence): sentence is string => sentence !== null);
}

function explainMeasurements(before: GarmentSpec, after: GarmentSpec): string[] {
  const type = getType(after.typeId) ?? getType(before.typeId);
  const name = (id: string): string => type?.pointsOfMeasure.find((point) => point.id === id)?.label ?? id;
  const said: string[] = [];
  for (const now of after.measurements) {
    const was = before.measurements.find((entry) => entry.pointId === now.pointId);
    if (!was) said.push(`${name(now.pointId)} set to ${formatCm(now.value)} cm.`);
    else if (was.value !== now.value) {
      said.push(`${name(now.pointId)} changed from ${formatCm(was.value)} cm to ${formatCm(now.value)} cm.`);
    } else if (was.provenance !== now.provenance) {
      said.push(`${name(now.pointId)} stays ${formatCm(now.value)} cm, ${sourceNote(now.provenance)}.`);
    }
  }
  for (const was of before.measurements) {
    if (!after.measurements.some((entry) => entry.pointId === was.pointId)) said.push(`${name(was.pointId)} measurement removed.`);
  }
  return said;
}

const colourText = (entry: PanelColour): string => (entry.colour !== "" ? entry.colour : (entry.swatch ?? ""));

function explainColourway(type: ResolvedType | undefined, was: Colourway, now: Colourway): string[] {
  const panel = (id: string): string => type?.panels.find((entry) => entry.id === id)?.label ?? id;
  const where = (id: string): string => `${panel(id)} in ${now.name}`;
  const said: string[] = [];
  for (const entry of now.colours) {
    const old = was.colours.find((colour) => colour.panelId === entry.panelId);
    if (!old) said.push(`${where(entry.panelId)} set to ${colourText(entry)}.`);
    else if (colourText(old) !== colourText(entry)) {
      said.push(`${where(entry.panelId)} changed from ${colourText(old)} to ${colourText(entry)}.`);
    } else if (old.swatch !== entry.swatch || old.provenance !== entry.provenance) {
      said.push(`${where(entry.panelId)} stays ${colourText(entry)}, ${sourceNote(entry.provenance)}.`);
    }
  }
  for (const old of was.colours) {
    if (!now.colours.some((entry) => entry.panelId === old.panelId)) said.push(`${where(old.panelId)} no longer has a colour.`);
  }
  if (was.name !== now.name) said.push(`Colourway ${was.name} renamed to ${now.name}.`);
  return said;
}

function explainColourways(before: GarmentSpec, after: GarmentSpec): string[] {
  const type = getType(after.typeId);
  const said: string[] = [];
  for (const now of after.colourways) {
    const was = before.colourways.find((entry) => entry.id === now.id);
    said.push(...(was ? explainColourway(type, was, now) : [`Colourway ${now.name} added.`]));
  }
  for (const was of before.colourways) {
    if (!after.colourways.some((entry) => entry.id === was.id)) said.push(`Colourway ${was.name} removed.`);
  }
  return said;
}

const FABRIC_WORDS = {
  name: "name",
  composition: "composition",
  construction: "construction",
  weightGsm: "weight",
  finish: "finish",
  consumption: "consumption",
  stretch: "stretch",
} as const;

function fabricValue(fabric: FabricSpec, field: keyof typeof FABRIC_WORDS): string {
  if (field === "weightGsm") return fabric.weightGsm === null ? "" : `${fabric.weightGsm} gsm`;
  if (field === "stretch") return fabric.stretch === "not-set" ? "not set" : fabric.stretch;
  return fabric[field];
}

function explainFabric(was: FabricSpec, now: FabricSpec): string[] {
  const said: string[] = [];
  for (const field of Object.keys(FABRIC_WORDS) as (keyof typeof FABRIC_WORDS)[]) {
    const old = fabricValue(was, field);
    const value = fabricValue(now, field);
    if (old === value) continue;
    const word = FABRIC_WORDS[field];
    if (value === "") said.push(`${now.name}: ${word} cleared.`);
    else if (old === "") said.push(`${now.name}: ${word} set to ${value}.`);
    else said.push(`${now.name}: ${word} changed from ${old} to ${value}.`);
  }
  return said;
}

function explainFabrics(before: GarmentSpec, after: GarmentSpec): string[] {
  const said: string[] = [];
  for (const now of after.fabrics) {
    const was = before.fabrics.find((entry) => entry.id === now.id);
    said.push(...(was ? explainFabric(was, now) : [`Fabric ${now.name} added.`]));
  }
  for (const was of before.fabrics) {
    if (!after.fabrics.some((entry) => entry.id === was.id)) said.push(`Fabric ${was.name} removed.`);
  }
  return said;
}

function explainLabelling(before: GarmentSpec, after: GarmentSpec): string[] {
  return LABELLING_FIELDS.flatMap((field) => {
    const was = before.labelling[field];
    const now = after.labelling[field];
    const label = LABELLING_LABELS[field];
    if (!now) return was ? [`${label} removed.`] : [];
    if (!was) return [`${label} set to ${now.text}.`];
    if (was.text !== now.text) return [`${label} changed from ${was.text} to ${now.text}.`];
    return was.provenance === now.provenance ? [] : [`${label} stays ${now.text}, ${sourceNote(now.provenance)}.`];
  });
}

function explainMarks(before: GarmentSpec, after: GarmentSpec): string[] {
  const was = before.namesAndNumbers;
  const now = after.namesAndNumbers;
  if (same(was, now)) return [];
  if (!now) return ["Player names and numbers removed."];
  const places = now.places.map((entry) => PLACE_DEFINITIONS[entry.place].label.toLowerCase()).join(", and ");
  return [was ? `Player names and numbers changed: ${places}.` : `Player names and numbers added: ${places}.`];
}

/** Parts with no sentence of their own yet. A change to one is still named, never skipped. */
const OTHER_PARTS = {
  sizing: "Size run changed.",
  panelFabrics: "Fabric assignments changed.",
  artwork: "Artwork changed.",
  components: "Components changed.",
  construction: "Construction changed.",
} as const;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * One plain sentence for each difference between two designs, worked out from the
 * designs alone, so what is said is what changed. An empty list means nothing changed.
 */
export function explainChanges(before: GarmentSpec, after: GarmentSpec): readonly string[] {
  const said: string[] = [];
  if (before.typeId !== after.typeId) {
    const label = (id: string): string => getType(id)?.label ?? id;
    said.push(`Garment type changed from ${label(before.typeId)} to ${label(after.typeId)}.`);
  }
  if (before.wearer !== after.wearer) {
    said.push(`Wearer changed from ${WEARER_LABELS[before.wearer]} to ${WEARER_LABELS[after.wearer]}.`);
  }
  said.push(
    ...explainOptions(before, after),
    ...explainMeasurements(before, after),
    ...explainColourways(before, after),
    ...explainFabrics(before, after),
    ...explainLabelling(before, after),
    ...explainMarks(before, after),
  );
  for (const [key, sentence] of Object.entries(OTHER_PARTS) as [keyof typeof OTHER_PARTS, string][]) {
    if (!same(before[key], after[key])) said.push(sentence);
  }
  return said;
}
