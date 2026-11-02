import { aspectOf, presetSize, type ArtboardPreset, type BoardKind, type Point, type Size } from "@/lib/launch";
import type { FlowStepSpec, FlowTemplateSpec } from "./types";

/**
 * Opening a flow template on a canvas (spec F-L4: a pack opens with a thumbnail board, a tutorial
 * card, yellow section labels and grey instruction notes).
 *
 * This file only works out *what* to add: the boards, where each one sits, what it is called, the
 * settings it keeps and the connectors between them. It writes nothing. `service.ts` carries the
 * plan out through L1's own `save_launch_board` and `connect_launch_boards`, so every board and
 * every connector goes through the checks L1 built and a pack cannot wire a canvas a person could
 * not have wired by hand.
 *
 * A template is applied on the server rather than through the panel contract on purpose. `addBoard`
 * of that contract gives a panel no id back, and a pack with fan-in needs the ids of the boards it
 * has just added to join them up. Doing it in one action also means a pack is laid out in one save
 * rather than fourteen, so a person never watches it appear a board at a time.
 */

/** A column of the canvas: one yellow section label and the boards under it. */
export const COLUMN_PX = 360;
export const ROW_PX = 320;

export interface SectionLabel {
  /** The yellow label's own words, as `07` writes them ("2 MOCKUPS"). */
  readonly label: string;
  readonly at: Point;
  /** The keys of the boards under it, in order. */
  readonly steps: readonly string[];
}

export interface BoardPlan {
  /** The template's own key for the step, kept in the board's settings so a rerun can find it. */
  readonly key: string;
  readonly kind: BoardKind;
  readonly name: string;
  readonly at: Point;
  readonly size: Size;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly inputVersion: number | null;
}

export interface LinkPlan {
  readonly from: string;
  readonly to: string;
  readonly inputIndex: number;
}

export interface FlowPlan {
  readonly slug: string;
  readonly title: string;
  readonly boards: readonly BoardPlan[];
  readonly links: readonly LinkPlan[];
  readonly sections: readonly SectionLabel[];
  /** How many assets the pack makes when it runs, for the card and the Run all button. */
  readonly assets: number;
}

export interface ApplyInput {
  /** The design the pack launches, written on the Design board so the garment is locked at once. */
  readonly designProjectId: string | null;
  /** The design version the pack starts from, or null while none is chosen. */
  readonly designVersion: number | null;
  /** The artboard sizes, as rows. A size is never a literal here (decision 0091, item 4). */
  readonly presets: readonly ArtboardPreset[];
  /** Where on the canvas the pack is dropped, so a second pack does not land on the first. */
  readonly origin?: Point;
}

const DEFAULT_SIZE: Size = { width: 1080, height: 1080 };

/**
 * The size a step's board opens at, from the artboard rows: a step that names a preset uses that
 * row, a step that names an aspect uses the row with that aspect, and anything else opens square.
 */
export function sizeForStep(step: FlowStepSpec, presets: readonly ArtboardPreset[]): Size {
  const key = step.settings["preset"];
  if (typeof key === "string") {
    const named = presets.find((preset) => preset.key === key);
    if (named) return presetSize(named);
  }
  const aspect = step.settings["aspect"];
  if (typeof aspect === "string") {
    const matching = presets.find((preset) => aspectOf(presetSize(preset)) === aspect);
    if (matching) return presetSize(matching);
  }
  return DEFAULT_SIZE;
}

/**
 * What a board keeps of its step. The step's own settings come first, then the five facts a rerun,
 * an estimate and the zip all read off the board itself: which pack and step it is, how it is made,
 * what format it comes out as and how many assets it counts as. **Nothing is read back out of the
 * template at run time**, which is what makes "swap the design and Run all" need no prompt again.
 */
export const settingsForStep = (slug: string, step: FlowStepSpec): Readonly<Record<string, unknown>> => ({
  ...step.settings,
  flowTemplate: slug,
  flowStep: step.key,
  generation: step.generation,
  format: step.format,
  assets: step.assets,
});

const designSettings = (slug: string, step: FlowStepSpec, input: ApplyInput): Readonly<Record<string, unknown>> => ({
  ...settingsForStep(slug, step),
  designProjectId: input.designProjectId,
});

/** The boards, the connectors and the section labels a pack opens with. Pure: it writes nothing. */
export function planTemplate(spec: FlowTemplateSpec, input: ApplyInput): FlowPlan {
  const origin = input.origin ?? { x: 0, y: 0 };
  const rows = new Map<string, number>();
  const boards: BoardPlan[] = spec.steps.map((step) => {
    const column = spec.sections.indexOf(step.section);
    const row = rows.get(step.section) ?? 0;
    rows.set(step.section, row + 1);
    return {
      key: step.key,
      kind: step.kind,
      name: step.name,
      at: { x: origin.x + column * COLUMN_PX, y: origin.y + row * ROW_PX },
      size: sizeForStep(step, input.presets),
      settings: step.kind === "design" ? designSettings(spec.slug, step, input) : settingsForStep(spec.slug, step),
      inputVersion: step.kind === "design" ? input.designVersion : null,
    };
  });
  const links: LinkPlan[] = spec.steps.flatMap((step) => step.feeds.map((from, index) => ({ from, to: step.key, inputIndex: index + 1 })));
  const sections: SectionLabel[] = spec.sections.map((label, column) => ({
    label,
    at: { x: origin.x + column * COLUMN_PX, y: origin.y - 48 },
    steps: spec.steps.filter((step) => step.section === label).map((step) => step.key),
  }));
  return { slug: spec.slug, title: spec.title, boards, links, sections, assets: spec.assets };
}
