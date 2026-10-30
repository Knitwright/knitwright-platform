import { buildPanelLayout, generatePlaceholder, PLACEHOLDER_LABEL, type GltfModel, type PanelLayout } from "@/lib/gltf";
import { draftArticle, toGradedPattern, toPatternPiece } from "@/lib/parametric";
import type { EditorDraft, FormValues } from "./slots";

/**
 * The bridge from the Form toolbar to the drafter (X3, `lib/parametric`) and to the 3D view
 * (`lib/gltf`). A change to an option or a length re-drafts the pieces for the shown size and
 * rebuilds the model from them, so the two views and the measurements always describe one design.
 *
 * Nothing is guessed. An article with no drafting script, or an option whose shape the article
 * does not define, comes back as "not drafted yet" with the reason, and the 3D view says so
 * instead of showing a shape nobody drafted.
 */

/** The platform's own version of the block, which the graded pattern records. */
const BLOCK_VERSION = 1;

/** Drafts one size of the article from the form. `null` for a design with no base article. */
export function draftForEditor(code: string | null, size: string, form: FormValues): EditorDraft | null {
  if (!code) return null;
  const outcome = draftArticle(code, size, { parameters: form.parameters, options: form.options });
  if (outcome.kind === "not-drafted-yet") return { kind: "not-drafted-yet", reason: outcome.reason, ruleId: outcome.ruleId };
  if (outcome.kind === "invalid") return { kind: "invalid", findings: outcome.findings };
  return { kind: "drafted", draft: outcome.draft, pieces: outcome.draft.pieces.map((piece) => toPatternPiece(piece, size)) };
}

export interface EditorModel {
  readonly layout: PanelLayout;
  readonly model: GltfModel;
  /** Said beside the view at all times, so nobody takes the placeholder for an artist's model. */
  readonly label: string;
}

/**
 * The 3D model of a drafted size: the panel layout and the placeholder glTF built from it. Null
 * when the design has no draft, or when the panels will not lay out, which is a fault to report
 * rather than a shape to invent.
 */
export function modelForDraft(draft: EditorDraft | null): EditorModel | null {
  if (draft?.kind !== "drafted") return null;
  try {
    const layout = buildPanelLayout(toGradedPattern([draft.draft], BLOCK_VERSION), draft.draft.size);
    return { layout, model: generatePlaceholder(layout), label: PLACEHOLDER_LABEL };
  } catch {
    return null;
  }
}

/** The points of measure the draft was built to, beside the values they were meant to have, for the canvas chips. */
export const draftChecks = (draft: EditorDraft | null): readonly Readonly<{ label: string; target: number; actual: number }>[] =>
  draft?.kind === "drafted" ? draft.draft.checks : [];

/** Whether the shell opens on 3D: it does for a base article the drafter can draw, and on 2D otherwise. */
export const opensIn3d = (draft: EditorDraft | null): boolean => draft?.kind === "drafted";
