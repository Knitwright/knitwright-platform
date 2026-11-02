import { FLOW_GAP_RULE, type FlowFormat, type FlowStepSpec, type Generation, type TutorialCard } from "../types";
import type { BoardKind } from "@/lib/launch";

/**
 * What every one of the six flow templates of `docs/spec/07-template-library.md` shares.
 *
 * **Nobody has reviewed these packs.** `07` gives each one a list of steps and a count of finished
 * assets, and no more: which scene each render uses, which aspect each post is at and how the
 * count is split are read from the spec's own words where it gives them and are otherwise a
 * labelled default with an owner question (decision 0096). Every row says so, and the template
 * card prints the note beside the pack.
 */

export const TEMPLATE_NOTE =
  "Knitwright draft from docs/spec/07-template-library.md, not reviewed by anyone. The asset count is the spec's own; the split across steps is a default.";

/** The spec's "Watch tutorial" card. No film has been made, and the card says so rather than pretending. */
export const tutorialFor = (title: string, body: string): TutorialCard => ({
  title: `Watch tutorial: ${title}`,
  body,
  url: null,
  note: "No tutorial film has been made yet, so this card opens nothing. The steps below say what each board does.",
  ruleId: FLOW_GAP_RULE,
});

type StepInput = Readonly<{
  key: string;
  section: string;
  kind: BoardKind;
  name: string;
  settings?: Readonly<Record<string, unknown>>;
  note?: string | null;
  generation?: Generation;
  assets?: number;
  format?: FlowFormat;
  feeds?: readonly string[];
}>;

/**
 * One step, with the defaults every step shares: the platform draws it, it counts as one asset, it
 * comes out as a PNG and it carries the gap rule. A step that differs says so itself.
 */
export const step = (input: StepInput): FlowStepSpec => ({
  key: input.key,
  section: input.section,
  kind: input.kind,
  name: input.name,
  settings: input.settings ?? {},
  note: input.note ?? null,
  generation: input.generation ?? "deterministic",
  assets: input.assets ?? 1,
  format: input.format ?? "png",
  feeds: input.feeds ?? [],
  ruleId: FLOW_GAP_RULE,
});

/** The Design board every pack starts from. It makes no asset of its own: it is the garment. */
export const designStep = (section: string, name: string, note: string): FlowStepSpec =>
  step({ key: "design", section, kind: "design", name, assets: 0, note, settings: { designProjectId: null } });

/** The note the spec puts beside the first step of every pack (F-L4's grey instruction notes). */
export const SWAP_NOTE = "Swap in your design, then press Run all. Every board keeps its own prompt, so nothing is typed again.";
export const REGENERATE_NOTE = "Press Regenerate on one board to redo just that one.";
export const EXPORT_NOTE = "Export all as a zip when the run finishes: one folder per format.";
