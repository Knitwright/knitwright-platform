import type { ComponentSlot, Condition, PointOfMeasure, SeamDefinition } from "../definitions";

/**
 * Small helpers the family data files share, so each family reads as a list of plain entries.
 * They build data only. Nothing here holds a quantity.
 */

export const when = (option: string, choices: readonly string[]): Condition => ({ option, in: choices });

/** A seam that applies always unless a condition is given. */
export const seam = (
  id: string,
  label: string,
  panels: readonly string[],
  seamClass: string,
  stitchClass: string,
  extra: Partial<Pick<SeamDefinition, "appliesWhen" | "unlessWhen">> = {},
): SeamDefinition => ({
  id,
  label,
  panels,
  seamClass,
  stitchClass,
  appliesWhen: extra.appliesWhen ?? [],
  unlessWhen: extra.unlessWhen ?? [],
});

export const slot = (
  id: string,
  label: string,
  kind: ComponentSlot["kind"],
  help: string,
  appliesWhen: readonly Condition[] = [],
  panels: readonly string[] = [],
  proposal = false,
): ComponentSlot => ({ id, label, kind, help, appliesWhen, panels, proposal });

/** Thread and labels, which every garment has whatever its family. Worded as for tops. */
export const THREAD_AND_LABELS: readonly ComponentSlot[] = [
  slot("main-thread", "Main thread", "thread", "The thread used to sew the garment, if used. Give its type, colour and brand if you know them."),
  slot("brand-label", "Brand label", "label", "The label that carries your brand name, if used. Say where it is sewn."),
  slot("care-label", "Care label", "label", "The label that tells the wearer how to wash the garment, if used."),
  slot("size-label", "Size label", "label", "The label that shows the size, if used."),
];

/** A point of measure that always applies. */
export const always = (
  id: string,
  label: string,
  group: PointOfMeasure["group"],
  howToMeasure: string,
): PointOfMeasure => ({ id, label, group, howToMeasure, appliesWhen: [] });

/** A point of measure that applies only when every condition holds. */
export const onlyWhen = (
  id: string,
  label: string,
  group: PointOfMeasure["group"],
  howToMeasure: string,
  appliesWhen: readonly Condition[],
  unavailableReason: string,
): PointOfMeasure => ({ id, label, group, howToMeasure, appliesWhen, unavailableReason });
