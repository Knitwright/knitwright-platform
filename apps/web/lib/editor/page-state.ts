import type { BaseArticle } from "@/lib/catalogue";
import { PARAMS, readAddress, type Query } from "./address";
import { shownSize, sizeChoices } from "./bottom-bar";
import { draftForEditor, modelForDraft, opensIn3d, type EditorModel } from "./draft";
import { resolveForm } from "./form";
import type { CanvasView, EditorDraft, FormValues, RailSegment } from "./slots";
import { parseBeside, parseView, showing } from "./views";

/**
 * Everything the editor's page works out before it draws: which toolbar and views the address
 * asks for, which size is shown, the form the article allows, the draft of that form and the 3D
 * model built from it. Pure, so the page itself only reads the database and hands this over.
 *
 * 3D is on by default for a base article the drafter can draw, and 2D for everything else; there
 * is no `SHOW_3D` switch in this path (plan v5 Y2, decision 0075). The model is built only when
 * the 3D view is actually on the canvas, so a page that does not show it does not carry it.
 */

export interface EditorPageState {
  readonly segment: RailSegment;
  readonly view: CanvasView;
  readonly beside: CanvasView | null;
  readonly size: string;
  readonly sizes: readonly string[];
  readonly form: FormValues;
  readonly draft: EditorDraft | null;
  readonly model: EditorModel | null;
}

export interface EditorPageInput {
  readonly query: Query;
  readonly article: BaseArticle | null;
  /** The design's own size run and base size, or null for a design that has not set one. */
  readonly sizing: Readonly<{ sizes: readonly string[]; baseSize: string }> | null;
}

export function editorPageState({ query, article, sizing }: EditorPageInput): EditorPageState {
  const asked = readAddress(query, "2d");
  const form = resolveForm(article, { options: asked.options, parameters: asked.parameters });
  const sizes = sizeChoices(sizing?.sizes ?? [], article?.sizeRange ?? []);
  const size = shownSize(asked.size, sizes, sizing?.baseSize ?? article?.sampleSize ?? "");
  const draft = draftForEditor(article?.code ?? null, size, form);
  const view = parseView(query[PARAMS.view], opensIn3d(draft) ? "3d" : "2d");
  const beside = parseBeside(query[PARAMS.beside], view);
  return {
    segment: asked.segment,
    view,
    beside,
    size,
    sizes,
    form,
    draft,
    model: showing(view, beside, "3d") ? modelForDraft(draft) : null,
  };
}
